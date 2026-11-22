import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SecretStore } from '../crypto/secret-store.js';
import {
  ConflictError,
  InternalError,
  NotFoundError,
  ValidationError,
} from '../errors/domain-errors.js';
import type { CatalogEntry, Connection } from '../generated/prisma/client.js';
import { AuthType } from '../generated/prisma/enums.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDomainError } from '../prisma/prisma-error.mapper.js';
import type {
  CreateConnectionInput,
  UpdateConnectionInput,
} from './connection.input.js';
import { type ConnectionModel, SetupState } from './connection.model.js';
import {
  DEFAULT_HEADER_NAME,
  DEFAULT_HEADER_PREFIX,
} from './connection-rules.js';

type ConnectionRow = Connection & { catalogEntry: CatalogEntry | null };

// The columns that hold credentials, as the service writes them.
interface CredentialColumns {
  headerName: string | null;
  headerPrefix: string | null;
  apiKeyCiphertext: string | null;
  apiKeyKeyId: string | null;
  oauthClientId: string | null;
  oauthClientSecretCiphertext: string | null;
  oauthClientSecretKeyId: string | null;
}

// A secret field in an input: left out keeps, null deletes, a string replaces.
type SecretChange = string | null | undefined;

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretStore: SecretStore,
  ) {}

  // The owner's connections, sorted by display name, ignoring case.
  async listForOwner(ownerId: string): Promise<ConnectionModel[]> {
    let rows: ConnectionRow[];
    try {
      rows = await this.prisma.connection.findMany({
        where: { ownerId },
        include: { catalogEntry: true },
      });
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
    return rows.map(toConnectionModel).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'en', {
        sensitivity: 'base',
      }),
    );
  }

  // One of the owner's connections. Another owner's connection, and an id
  // that is not a UUID, are not found (REQ-CONN-001).
  async getForOwner(ownerId: string, id: string): Promise<ConnectionModel> {
    return toConnectionModel(await this.findRow(ownerId, id));
  }

  // REQ-CONN-020 to REQ-CONN-022 and REQ-CONN-040 to REQ-CONN-043.
  async create(
    ownerId: string,
    input: CreateConnectionInput,
  ): Promise<ConnectionModel> {
    if (input.authType === AuthType.API_KEY && !input.apiKey) {
      throw new ValidationError('apiKey is required for API_KEY');
    }
    if (
      input.authType === AuthType.OAUTH_MANUAL &&
      (!input.oauthClientId || !input.oauthClientSecret)
    ) {
      throw new ValidationError(
        'oauthClientId and oauthClientSecret are required for OAUTH_MANUAL',
      );
    }
    assertOnlyFieldsFor(input.authType, input);
    await this.assertNameNotUsedByCatalog(ownerId, input.displayName);

    try {
      const row = await this.prisma.$transaction(async (tx) => {
        // Secrets are encrypted with the row id in their context, so the row
        // is inserted first with every credential column except the secrets.
        const settings = await this.credentialColumns(
          '',
          input.authType,
          { ...input, apiKey: undefined, oauthClientSecret: undefined },
          emptyCredentials(),
        );
        const created = await tx.connection.create({
          data: {
            ownerId,
            displayName: input.displayName,
            description: input.description ?? '',
            url: input.url,
            authType: input.authType,
            ...settings,
          },
        });
        const credentials = await this.credentialColumns(
          created.id,
          input.authType,
          input,
          emptyCredentials(),
        );
        return tx.connection.update({
          where: { id: created.id },
          data: credentials,
          include: { catalogEntry: true },
        });
      });
      return toConnectionModel(row);
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
  }

  // REQ-CONN-023 and REQ-CONN-042. Catalog-based connections take their
  // settings from the entry, so only custom ones can be changed here.
  async update(
    ownerId: string,
    id: string,
    input: UpdateConnectionInput,
  ): Promise<ConnectionModel> {
    const row = await this.findRow(ownerId, id);
    if (row.catalogEntryId !== null || row.authType === null) {
      throw new ValidationError(
        'A catalog-based connection takes its settings from the catalog entry',
      );
    }

    const authType = input.authType ?? row.authType;
    const urlChanged = input.url !== undefined && input.url !== row.url;
    const authTypeChanged = authType !== row.authType;
    assertOnlyFieldsFor(authType, input);

    // Credentials are never sent to a URL or auth type they were not
    // entered for, so a change of either starts from no credentials.
    const kept =
      urlChanged || authTypeChanged ? emptyCredentials() : credentialsOf(row);
    const credentials = await this.credentialColumns(
      row.id,
      authType,
      input,
      kept,
    );
    if (
      authType === AuthType.OAUTH_MANUAL &&
      credentials.oauthClientId === null
    ) {
      throw new ValidationError('oauthClientId is required for OAUTH_MANUAL');
    }

    const displayName = input.displayName ?? row.displayName;
    if (
      displayName !== null &&
      displayName.toLowerCase() !== row.displayName?.toLowerCase()
    ) {
      await this.assertNameNotUsedByCatalog(ownerId, displayName);
    }

    try {
      const updated = await this.prisma.connection.update({
        where: { id: row.id, ownerId },
        data: {
          displayName,
          description:
            input.description === undefined
              ? row.description
              : (input.description ?? ''),
          url: input.url ?? row.url,
          authType,
          ...credentials,
        },
        include: { catalogEntry: true },
      });
      return toConnectionModel(updated);
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
  }

  // REQ-CONN-051.
  async setEnabled(
    ownerId: string,
    id: string,
    enabled: boolean,
  ): Promise<ConnectionModel> {
    assertUuid(id);
    try {
      const row = await this.prisma.connection.update({
        where: { id, ownerId },
        data: { enabled },
        include: { catalogEntry: true },
      });
      return toConnectionModel(row);
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
  }

  // REQ-CONN-052. Returns the id of the removed connection.
  async remove(ownerId: string, id: string): Promise<string> {
    assertUuid(id);
    try {
      await this.prisma.connection.delete({ where: { id, ownerId } });
      return id;
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
  }

  private async findRow(ownerId: string, id: string): Promise<ConnectionRow> {
    assertUuid(id);
    let row: ConnectionRow | null;
    try {
      row = await this.prisma.connection.findFirst({
        where: { id, ownerId },
        include: { catalogEntry: true },
      });
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
    if (!row) throw new NotFoundError('Connection not found');
    return row;
  }

  // REQ-CONN-021: a custom name must not match a catalog server the owner
  // has switched on. The unique index covers custom against custom.
  private async assertNameNotUsedByCatalog(
    ownerId: string,
    displayName: string,
  ): Promise<void> {
    let match: { id: string } | null;
    try {
      match = await this.prisma.connection.findFirst({
        where: {
          ownerId,
          catalogEntry: { displayName: { equals: displayName } },
        },
        select: { id: true },
      });
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
    if (match) {
      throw new ConflictError(
        'A catalog server you switched on already has this name',
      );
    }
  }

  // The credential columns after applying the input's changes to `kept`.
  private async credentialColumns(
    connectionId: string,
    authType: AuthType,
    input: {
      apiKey?: SecretChange;
      headerName?: string | null;
      headerPrefix?: string | null;
      oauthClientId?: string | null;
      oauthClientSecret?: SecretChange;
    },
    kept: CredentialColumns,
  ): Promise<CredentialColumns> {
    const next = emptyCredentials();
    if (authType === AuthType.API_KEY) {
      next.headerName =
        input.headerName ?? kept.headerName ?? DEFAULT_HEADER_NAME;
      next.headerPrefix =
        input.headerPrefix ?? kept.headerPrefix ?? DEFAULT_HEADER_PREFIX;
      const apiKey = await this.applySecret(
        connectionId,
        'api_key',
        input.apiKey,
        { ciphertext: kept.apiKeyCiphertext, keyId: kept.apiKeyKeyId },
      );
      next.apiKeyCiphertext = apiKey.ciphertext;
      next.apiKeyKeyId = apiKey.keyId;
    }
    if (authType === AuthType.OAUTH_MANUAL) {
      next.oauthClientId = input.oauthClientId ?? kept.oauthClientId;
      const secret = await this.applySecret(
        connectionId,
        'oauth_client_secret',
        input.oauthClientSecret,
        {
          ciphertext: kept.oauthClientSecretCiphertext,
          keyId: kept.oauthClientSecretKeyId,
        },
      );
      next.oauthClientSecretCiphertext = secret.ciphertext;
      next.oauthClientSecretKeyId = secret.keyId;
    }
    return next;
  }

  private async applySecret(
    connectionId: string,
    field: 'api_key' | 'oauth_client_secret',
    change: SecretChange,
    kept: { ciphertext: string | null; keyId: string | null },
  ): Promise<{ ciphertext: string | null; keyId: string | null }> {
    if (change === undefined) return kept;
    if (change === null) return { ciphertext: null, keyId: null };
    return this.secretStore.encrypt(
      change,
      `connection:${connectionId}:${field}`,
    );
  }
}

function assertUuid(id: string): void {
  if (!z.uuid().safeParse(id).success) {
    throw new NotFoundError('Connection not found');
  }
}

// REQ-CONN-040: credential fields belong to one auth type each.
function assertOnlyFieldsFor(
  authType: AuthType,
  input: {
    apiKey?: unknown;
    headerName?: unknown;
    headerPrefix?: unknown;
    oauthClientId?: unknown;
    oauthClientSecret?: unknown;
  },
): void {
  const given = (value: unknown) => value !== undefined && value !== null;
  if (
    authType !== AuthType.API_KEY &&
    (given(input.apiKey) ||
      given(input.headerName) ||
      given(input.headerPrefix))
  ) {
    throw new ValidationError(
      'apiKey, headerName and headerPrefix are only for API_KEY',
    );
  }
  if (
    authType !== AuthType.OAUTH_MANUAL &&
    (given(input.oauthClientId) || given(input.oauthClientSecret))
  ) {
    throw new ValidationError(
      'oauthClientId and oauthClientSecret are only for OAUTH_MANUAL',
    );
  }
}

function emptyCredentials(): CredentialColumns {
  return {
    headerName: null,
    headerPrefix: null,
    apiKeyCiphertext: null,
    apiKeyKeyId: null,
    oauthClientId: null,
    oauthClientSecretCiphertext: null,
    oauthClientSecretKeyId: null,
  };
}

function credentialsOf(row: ConnectionRow): CredentialColumns {
  return {
    headerName: row.headerName,
    headerPrefix: row.headerPrefix,
    apiKeyCiphertext: row.apiKeyCiphertext,
    apiKeyKeyId: row.apiKeyKeyId,
    oauthClientId: row.oauthClientId,
    oauthClientSecretCiphertext: row.oauthClientSecretCiphertext,
    oauthClientSecretKeyId: row.oauthClientSecretKeyId,
  };
}

// REQ-CONN-044.
function setupStateOf(authType: AuthType, hasApiKey: boolean): SetupState {
  switch (authType) {
    case AuthType.NONE:
      return SetupState.READY;
    case AuthType.API_KEY:
      return hasApiKey ? SetupState.READY : SetupState.NEEDS_CREDENTIALS;
    case AuthType.OAUTH_DCR:
    case AuthType.OAUTH_MANUAL:
      return SetupState.NEEDS_CREDENTIALS;
  }
}

// A catalog-based connection takes these fields from its entry (REQ-CONN-012).
// The check constraint connection_catalog_or_custom_check guarantees that one
// of the two sources has them.
function toConnectionModel(row: ConnectionRow): ConnectionModel {
  const source = row.catalogEntry ?? row;
  const { displayName, url, authType } = source;
  if (displayName === null || url === null || authType === null) {
    throw new InternalError({
      cause: new Error(
        `Connection ${row.id} has no display name, URL or auth type`,
      ),
    });
  }
  const hasApiKey = row.apiKeyCiphertext !== null;
  return {
    id: row.id,
    catalogEntryId: row.catalogEntryId,
    displayName,
    description: source.description ?? '',
    url,
    authType,
    headerName: source.headerName,
    headerPrefix: source.headerPrefix,
    hasApiKey,
    oauthClientId: row.oauthClientId,
    hasClientSecret: row.oauthClientSecretCiphertext !== null,
    setupState: setupStateOf(authType, hasApiKey),
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
