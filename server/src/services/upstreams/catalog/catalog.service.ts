import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { SecretStore } from '../../../crypto/secret-store.js';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../errors/domain-errors.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { AuthType } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { toDomainError } from '../../../prisma/prisma-error.mapper.js';
import { iconPath } from '../../icons/icons.service.js';
import type { Connection } from '../connections/connection.interface.js';
import {
  CONNECTION_INCLUDE,
  toConnection,
} from '../connections/connection.mapper.js';
import { UpstreamRegistryService } from '../registry/upstream-registry.service.js';
import type {
  CatalogEntry,
  SetCatalogOAuthClientData,
  UrlParameter,
} from './catalog-entry.interface.js';
import {
  isUrlParameterValue,
  templateParameters,
  type UrlParameters,
  urlParametersSchema,
} from './url-template.js';

const { DbNull } = Prisma;

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: UpstreamRegistryService,
    private readonly secretStore: SecretStore,
  ) {}

  // REQ-CONN-011: every entry, sorted by display name, with its auth options
  // and the owner's connection for it.
  async listForOwner(ownerId: string): Promise<CatalogEntry[]> {
    try {
      const entries = await this.prisma.catalogEntry.findMany({
        orderBy: { displayName: 'asc' },
        include: entryInclude(ownerId),
      });
      return entries.map(toCatalogEntry);
    } catch (error) {
      throw toDomainError(error, 'Catalog entry');
    }
  }

  // T22: sets the OAuth app of the entry's OAUTH_MANUAL option. Every
  // connection on the option uses it, so each one's client is reopened.
  async setOAuthClient(
    ownerId: string,
    catalogEntryId: string,
    input: SetCatalogOAuthClientData,
  ): Promise<CatalogEntry> {
    if (!z.uuid().safeParse(catalogEntryId).success) {
      throw new NotFoundError('Catalog entry not found');
    }
    try {
      const option = await this.prisma.catalogAuthOption.findUnique({
        where: {
          catalogEntryId_authType: {
            catalogEntryId,
            authType: AuthType.OAUTH_MANUAL,
          },
        },
        select: {
          id: true,
          oauthClientSecretCiphertext: true,
          oauthClientSecretKeyId: true,
          connections: { select: { id: true } },
        },
      });
      if (!option) {
        const entry = await this.prisma.catalogEntry.findUnique({
          where: { id: catalogEntryId },
          select: { id: true },
        });
        if (!entry) throw new NotFoundError('Catalog entry not found');
        throw new ValidationError(
          'This catalog entry does not offer OAUTH_MANUAL',
        );
      }

      let secret = {
        ciphertext: option.oauthClientSecretCiphertext,
        keyId: option.oauthClientSecretKeyId,
      };
      if (input.clientSecret === null) {
        secret = { ciphertext: null, keyId: null };
      } else if (input.clientSecret !== undefined) {
        secret = await this.secretStore.encrypt(
          input.clientSecret,
          `catalog_auth_option:${option.id}:oauth_client_secret`,
        );
      }
      await this.prisma.catalogAuthOption.update({
        where: { id: option.id },
        data: {
          oauthClientId: input.clientId,
          oauthClientSecretCiphertext: secret.ciphertext,
          oauthClientSecretKeyId: secret.keyId,
        },
      });
      for (const connection of option.connections) {
        this.registry.syncInBackground(connection.id);
      }

      const entry = await this.prisma.catalogEntry.findUniqueOrThrow({
        where: { id: catalogEntryId },
        include: entryInclude(ownerId),
      });
      return toCatalogEntry(entry);
    } catch (error) {
      throw toDomainError(error, 'Catalog entry');
    }
  }

  // REQ-CONN-012: creates the owner's connection for the entry, or enables
  // the existing one. Moving to another auth option deletes the stored
  // credentials, as a changed auth type does (REQ-CONN-023).
  //
  // T22: an option whose URL holds placeholders needs a value for each.
  // Values left out keep the connection's stored ones. Other values, like
  // another option, delete the stored credentials.
  async switchOn(
    ownerId: string,
    catalogEntryId: string,
    authType: AuthType,
    urlParameters?: UrlParameter[],
  ): Promise<Connection> {
    if (!z.uuid().safeParse(catalogEntryId).success) {
      throw new NotFoundError('Catalog entry not found');
    }
    try {
      const entry = await this.prisma.catalogEntry.findUnique({
        where: { id: catalogEntryId },
        include: { authOptions: true },
      });
      if (!entry) throw new NotFoundError('Catalog entry not found');

      const option = entry.authOptions.find((o) => o.authType === authType);
      if (!option) {
        throw new ValidationError(
          `This catalog entry does not offer ${authType}`,
        );
      }
      // T22: an OAUTH_MANUAL option is offered once its OAuth app is set.
      if (
        option.authType === AuthType.OAUTH_MANUAL &&
        option.oauthClientId === null
      ) {
        throw new ValidationError(
          'Set the OAuth app of this catalog entry before you switch it on with OAUTH_MANUAL',
        );
      }

      // REQ-CONN-021: the entry's name must not match a custom connection.
      const custom = await this.prisma.connection.findFirst({
        where: {
          ownerId,
          catalogEntryId: null,
          displayName: { equals: entry.displayName },
        },
        select: { id: true },
      });
      if (custom) {
        throw new ConflictError(
          'A custom connection already has this name. Rename it to switch on the catalog entry',
        );
      }

      const existing = await this.prisma.connection.findFirst({
        where: { ownerId, catalogEntryId },
        select: { id: true, catalogAuthOptionId: true, urlParameters: true },
      });
      const parameters = resolveUrlParameters(
        entry.displayName,
        option.url,
        urlParameters,
        urlParametersSchema.safeParse(existing?.urlParameters ?? {}).data ?? {},
      );
      const parametersColumn = parameters ?? DbNull;
      if (!existing) {
        const created = await this.prisma.connection.create({
          data: {
            ownerId,
            catalogEntryId,
            catalogAuthOptionId: option.id,
            urlParameters: parametersColumn,
          },
          include: CONNECTION_INCLUDE,
        });
        this.registry.syncInBackground(created.id);
        return toConnection(created);
      }

      // Credentials are never sent to a URL they were not entered for.
      const sameTarget =
        existing.catalogAuthOptionId === option.id &&
        sameParameters(parameters, existing.urlParameters);
      const updated = await this.prisma.$transaction(async (tx) => {
        // Another auth option or URL starts from no credentials, OAuth
        // included.
        if (!sameTarget) {
          await tx.connectionOAuth.deleteMany({
            where: { connectionId: existing.id },
          });
        }
        return tx.connection.update({
          where: { id: existing.id, ownerId },
          data: sameTarget
            ? { enabled: true }
            : {
                enabled: true,
                catalogAuthOptionId: option.id,
                urlParameters: parametersColumn,
                apiKeyCiphertext: null,
                apiKeyKeyId: null,
              },
          include: CONNECTION_INCLUDE,
        });
      });
      this.registry.syncInBackground(updated.id);
      return toConnection(updated);
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
  }
}

// The relations a catalog entry is read with: its auth options, and the
// owner's connection for it.
function entryInclude(ownerId: string) {
  return {
    authOptions: { orderBy: { authType: 'asc' } },
    connections: { where: { ownerId }, include: CONNECTION_INCLUDE },
  } satisfies Prisma.CatalogEntryInclude;
}

type EntryRow = Prisma.CatalogEntryGetPayload<{
  include: ReturnType<typeof entryInclude>;
}>;

function toCatalogEntry(entry: EntryRow): CatalogEntry {
  return {
    id: entry.id,
    key: entry.key,
    displayName: entry.displayName,
    description: entry.description,
    iconUrl: iconPath(entry.iconId, entry.displayName),
    authOptions: entry.authOptions.map((option) => ({
      authType: option.authType,
      url: option.url,
      headerName: option.headerName,
      headerPrefix: option.headerPrefix,
      oauthClientId: option.oauthClientId,
      hasClientSecret: option.oauthClientSecretCiphertext !== null,
      urlParameters: templateParameters(option.url),
    })),
    connection: entry.connections[0]
      ? toConnection(entry.connections[0])
      : null,
  };
}

// The values for the placeholders of an option's URL (T22): the given ones,
// or else the stored ones. Null for a URL without placeholders.
function resolveUrlParameters(
  serverName: string,
  url: string,
  given: UrlParameter[] | undefined,
  stored: UrlParameters,
): UrlParameters | null {
  const names = templateParameters(url);
  if (given !== undefined) {
    const seen = new Set<string>();
    for (const { name, value } of given) {
      if (!names.includes(name) || seen.has(name)) {
        throw new ValidationError(`${serverName} does not take ${name}`);
      }
      if (!isUrlParameterValue(value)) {
        throw new ValidationError(
          `${name} may hold only letters, digits, dots, underscores and hyphens`,
        );
      }
      seen.add(name);
    }
  }
  if (names.length === 0) return null;
  const source = given
    ? Object.fromEntries(given.map(({ name, value }) => [name, value]))
    : stored;
  const values: UrlParameters = {};
  for (const name of names) {
    const value = source[name];
    if (value === undefined || !isUrlParameterValue(value)) {
      throw new ValidationError(`${serverName} needs ${name}`);
    }
    values[name] = value;
  }
  return values;
}

function sameParameters(next: UrlParameters | null, stored: unknown): boolean {
  const previous = urlParametersSchema.safeParse(stored).data ?? null;
  if (next === null || previous === null) return next === previous;
  const keys = Object.keys(next);
  return (
    keys.length === Object.keys(previous).length &&
    keys.every((key) => next[key] === previous[key])
  );
}
