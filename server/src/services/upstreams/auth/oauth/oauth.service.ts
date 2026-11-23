import {
  auth,
  type OAuthClientInformation,
} from '@modelcontextprotocol/client';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { upstreamsConfig } from '../../../../config/upstreams.config.js';
import { SecretStore } from '../../../../crypto/secret-store.js';
import {
  NotFoundError,
  UpstreamUnavailableError,
  ValidationError,
} from '../../../../errors/domain-errors.js';
import { AuthType } from '../../../../generated/prisma/enums.js';
import {
  findNetworkRuleError,
  GuardedFetch,
} from '../../../../net/guarded-fetch.js';
import { ConnectionsService } from '../../connections/connections.service.js';
import { UpstreamRegistryService } from '../../registry/upstream-registry.service.js';
import { ConnectionOAuthService } from './connection-oauth.service.js';
import { ConnectionOAuthProvider } from './connection-oauth-provider.js';
import { OAUTH_FLOW_TTL_MS, OAuthOutcome } from './oauth.interface.js';
import { OAuthFlowStore } from './oauth-flow-store.js';

// The owner's side of OAuth (T21, T22): start an authorization, and finish
// it in the callback. OAUTH_DCR registers OneDoor with the authorization
// server; OAUTH_MANUAL uses the OAuth app the owner entered.
@Injectable()
export class OAuthService {
  private readonly logger = new Logger(OAuthService.name);

  constructor(
    private readonly connections: ConnectionsService,
    private readonly store: ConnectionOAuthService,
    private readonly flows: OAuthFlowStore,
    private readonly secretStore: SecretStore,
    private readonly guardedFetch: GuardedFetch,
    private readonly registry: UpstreamRegistryService,
    @Inject(upstreamsConfig.KEY)
    private readonly upstreams: ConfigType<typeof upstreamsConfig>,
  ) {}

  // Discovers the authorization server, registers OneDoor with it when the
  // connection has no client yet, and returns the URL to send the owner to.
  // Every request goes through GuardedFetch.
  async start(ownerId: string, connectionId: string): Promise<string> {
    const connection = await this.connections.getForOwner(
      ownerId,
      connectionId,
    );
    if (!isOAuth(connection.authType)) {
      throw new ValidationError(
        'Only OAUTH_DCR and OAUTH_MANUAL connections are authorized this way',
      );
    }
    const client = await this.manualClient(connectionId, connection.authType);
    if (client === null) {
      throw new ValidationError(
        `${connection.displayName} needs the client id of its OAuth app first`,
      );
    }
    const provider = this.provider(
      connectionId,
      ownerId,
      { kind: 'start' },
      client,
    );
    try {
      await auth(provider, {
        serverUrl: connection.url,
        fetchFn: this.guardedFetch.create({ bodyStaysOnOrigin: true }),
        forceReauthorization: true,
      });
    } catch (error) {
      this.logger.warn(
        `Could not start the authorization of connection ${connectionId}: ${failureKind(error)}`,
      );
      throw new UpstreamUnavailableError(
        `Could not start the authorization with ${connection.displayName}`,
      );
    }
    const url = provider.authorizationUrl;
    const state = provider.lastState;
    const verifier = provider.savedCodeVerifier;
    if (!url || !state || !verifier) {
      throw new UpstreamUnavailableError(
        `${connection.displayName} did not start an authorization`,
      );
    }
    // The browser is sent there, so only a web URL is accepted.
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new UpstreamUnavailableError(
        `${connection.displayName} gave an authorization URL that is not http or https`,
      );
    }
    await this.flows.save(
      state,
      {
        connectionId,
        ownerId,
        codeVerifier: await this.secretStore.encrypt(
          verifier,
          `oauth_flow:${state}:code_verifier`,
        ),
      },
      OAUTH_FLOW_TTL_MS,
    );
    return url.toString();
  }

  // Handles the authorization server's redirect back. Returns where to send
  // the owner's browser: the server's page in web, with the outcome. The
  // authorization server's own error text is never shown.
  async finish(params: URLSearchParams): Promise<string> {
    const state = params.get('state');
    const flow = state ? await this.flows.take(state) : null;
    if (!state || !flow) return this.webUrl(null, OAuthOutcome.EXPIRED);
    const { connectionId, ownerId } = flow;

    if (params.has('error')) {
      return this.webUrl(connectionId, OAuthOutcome.DENIED);
    }
    const code = params.get('code');
    let connection: Awaited<ReturnType<ConnectionsService['getForOwner']>>;
    try {
      connection = await this.connections.getForOwner(ownerId, connectionId);
    } catch (error) {
      if (error instanceof NotFoundError) {
        return this.webUrl(null, OAuthOutcome.EXPIRED);
      }
      throw error;
    }
    if (!code || !isOAuth(connection.authType)) {
      return this.webUrl(connectionId, OAuthOutcome.FAILED);
    }
    const client = await this.manualClient(connectionId, connection.authType);
    if (client === null) return this.webUrl(connectionId, OAuthOutcome.FAILED);

    const codeVerifier = await this.secretStore.decrypt(
      flow.codeVerifier,
      `oauth_flow:${state}:code_verifier`,
    );
    const provider = this.provider(
      connectionId,
      ownerId,
      { kind: 'callback', codeVerifier },
      client,
    );
    try {
      const result = await auth(provider, {
        serverUrl: connection.url,
        authorizationCode: code,
        iss: params.get('iss') ?? undefined,
        fetchFn: this.guardedFetch.create({ bodyStaysOnOrigin: true }),
      });
      if (result !== 'AUTHORIZED') {
        return this.webUrl(connectionId, OAuthOutcome.FAILED);
      }
    } catch (error) {
      this.logger.warn(
        `Could not finish the authorization of connection ${connectionId}: ${failureKind(error)}`,
      );
      return this.webUrl(connectionId, OAuthOutcome.FAILED);
    }
    this.logger.log(`Authorized connection ${connectionId}`);
    this.registry.syncInBackground(connectionId);
    return this.webUrl(connectionId, OAuthOutcome.AUTHORIZED);
  }

  // The redirect URI to register in an OAuth app (OAUTH_MANUAL).
  redirectUrl(): string {
    return this.upstreams.oauthRedirectUrl;
  }

  // OAUTH_MANUAL: the owner's OAuth app, or null when it has no client id.
  // OAUTH_DCR: undefined, so OneDoor registers its own client.
  private async manualClient(
    connectionId: string,
    authType: AuthType,
  ): Promise<OAuthClientInformation | null | undefined> {
    if (authType !== AuthType.OAUTH_MANUAL) return undefined;
    return this.store.manualClient(connectionId);
  }

  private provider(
    connectionId: string,
    ownerId: string,
    mode: ConstructorParameters<typeof ConnectionOAuthProvider>[4],
    client: OAuthClientInformation | undefined,
  ): ConnectionOAuthProvider {
    return new ConnectionOAuthProvider(
      connectionId,
      ownerId,
      this.store,
      this.upstreams.oauthRedirectUrl,
      mode,
      client,
    );
  }

  // The servers screen, or one server's page, on the callback's origin.
  private webUrl(connectionId: string | null, outcome: OAuthOutcome): string {
    const url = new URL(
      connectionId ? `/servers/${connectionId}` : '/servers',
      this.upstreams.oauthRedirectUrl,
    );
    url.searchParams.set('oauth', outcome);
    return url.toString();
  }
}

function isOAuth(authType: AuthType): boolean {
  return authType === AuthType.OAUTH_DCR || authType === AuthType.OAUTH_MANUAL;
}

// Fixed text for the log: an upstream's own error text is not repeated.
function failureKind(error: unknown): string {
  const rule = findNetworkRuleError(error);
  if (rule) return `the network rules stopped the request: ${rule.message}`;
  return error instanceof Error ? error.name : 'unknown error';
}
