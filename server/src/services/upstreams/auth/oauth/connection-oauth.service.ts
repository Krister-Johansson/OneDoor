import type {
  OAuthClientInformation,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client';
import { Injectable } from '@nestjs/common';
import { SecretStore } from '../../../../crypto/secret-store.js';
import { Prisma } from '../../../../generated/prisma/client.js';
import { PrismaService } from '../../../../prisma/prisma.service.js';
import { toDomainError } from '../../../../prisma/prisma-error.mapper.js';
import type { ConnectionOAuthState } from './oauth.interface.js';

type Field = 'client' | 'tokens';

// Reads and writes the OAuth state of connections (T21). The client
// registration and the tokens are JSON encrypted by SecretStore with the
// context `connection_oauth:<connection id>:<field>`.
@Injectable()
export class ConnectionOAuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly secretStore: SecretStore,
  ) {}

  async load(connectionId: string): Promise<ConnectionOAuthState> {
    const row = await this.run(() =>
      this.prisma.connectionOAuth.findUnique({ where: { connectionId } }),
    );
    if (!row) return {};
    return {
      client: await this.decrypt<StoredOAuthClientInformation>(
        connectionId,
        'client',
        row.clientCiphertext,
        row.clientKeyId,
      ),
      tokens: await this.decrypt<StoredOAuthTokens>(
        connectionId,
        'tokens',
        row.tokensCiphertext,
        row.tokensKeyId,
      ),
      discovery: (row.discoveryState ?? undefined) as
        | OAuthDiscoveryState
        | undefined,
    };
  }

  // The OAuth app an OAUTH_MANUAL connection uses: the client id and, for a
  // confidential client, the decrypted secret. A catalog-based connection
  // uses its auth option's app (T22). Null when no client id is stored.
  // Holds a secret: keep it in memory only.
  async manualClient(
    connectionId: string,
  ): Promise<OAuthClientInformation | null> {
    const app = {
      oauthClientId: true,
      oauthClientSecretCiphertext: true,
      oauthClientSecretKeyId: true,
    } as const;
    const row = await this.run(() =>
      this.prisma.connection.findUnique({
        where: { id: connectionId },
        select: { ...app, catalogAuthOption: { select: { id: true, ...app } } },
      }),
    );
    if (!row) return null;
    const option = row.catalogAuthOption;
    const source = option ?? row;
    if (!source.oauthClientId) return null;
    const context = option
      ? `catalog_auth_option:${option.id}:oauth_client_secret`
      : `connection:${connectionId}:oauth_client_secret`;
    const secret =
      source.oauthClientSecretCiphertext && source.oauthClientSecretKeyId
        ? await this.secretStore.decrypt(
            {
              ciphertext: source.oauthClientSecretCiphertext,
              keyId: source.oauthClientSecretKeyId,
            },
            context,
          )
        : undefined;
    return {
      client_id: source.oauthClientId,
      ...(secret !== undefined && { client_secret: secret }),
    };
  }

  async saveClient(
    connectionId: string,
    ownerId: string,
    client: StoredOAuthClientInformation,
  ): Promise<void> {
    const secret = await this.encrypt(connectionId, 'client', client);
    await this.write(connectionId, ownerId, {
      clientCiphertext: secret.ciphertext,
      clientKeyId: secret.keyId,
    });
  }

  // `authorized` marks a completed authorization, which makes the registry
  // open a new client. A refresh leaves it out.
  async saveTokens(
    connectionId: string,
    ownerId: string,
    tokens: StoredOAuthTokens,
    authorized: boolean,
  ): Promise<void> {
    const secret = await this.encrypt(connectionId, 'tokens', tokens);
    await this.write(connectionId, ownerId, {
      tokensCiphertext: secret.ciphertext,
      tokensKeyId: secret.keyId,
      ...(authorized && { authorizedAt: new Date() }),
    });
  }

  async saveDiscovery(
    connectionId: string,
    ownerId: string,
    discovery: OAuthDiscoveryState,
  ): Promise<void> {
    await this.write(connectionId, ownerId, {
      discoveryState: discovery as unknown as Prisma.InputJsonObject,
    });
  }

  // Deletes the given parts. Without tokens the connection needs a new
  // authorization (REQ-CONN-044).
  async clear(
    connectionId: string,
    parts: { client?: boolean; tokens?: boolean; discovery?: boolean },
  ): Promise<void> {
    await this.run(() =>
      this.prisma.connectionOAuth.updateMany({
        where: { connectionId },
        data: {
          ...(parts.client && { clientCiphertext: null, clientKeyId: null }),
          ...(parts.tokens && { tokensCiphertext: null, tokensKeyId: null }),
          ...(parts.discovery && { discoveryState: Prisma.DbNull }),
        },
      }),
    );
  }

  private async write(
    connectionId: string,
    ownerId: string,
    data: Prisma.ConnectionOAuthUncheckedUpdateInput,
  ): Promise<void> {
    await this.run(() =>
      this.prisma.connectionOAuth.upsert({
        where: { connectionId },
        create: {
          connectionId,
          ownerId,
          ...(data as Omit<
            Prisma.ConnectionOAuthUncheckedCreateInput,
            'connectionId' | 'ownerId'
          >),
        },
        update: data,
      }),
    );
  }

  private encrypt(connectionId: string, field: Field, value: unknown) {
    return this.secretStore.encrypt(
      JSON.stringify(value),
      `connection_oauth:${connectionId}:${field}`,
    );
  }

  private async decrypt<T>(
    connectionId: string,
    field: Field,
    ciphertext: string | null,
    keyId: string | null,
  ): Promise<T | undefined> {
    if (ciphertext === null || keyId === null) return undefined;
    const json = await this.secretStore.decrypt(
      { ciphertext, keyId },
      `connection_oauth:${connectionId}:${field}`,
    );
    return JSON.parse(json) as T;
  }

  private async run<T>(query: () => Promise<T>): Promise<T> {
    try {
      return await query();
    } catch (error) {
      throw toDomainError(error, 'ConnectionOAuth');
    }
  }
}
