import { randomBytes } from 'node:crypto';
import type {
  OAuthClientInformation,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client';
import type { ConnectionOAuthService } from './connection-oauth.service.js';
import type { ConnectionOAuthState } from './oauth.interface.js';

// What the provider is used for. `start` begins an authorization and keeps
// the authorization URL; `callback` exchanges the code with the verifier the
// start kept; `client` serves an upstream client, which cannot send a user
// anywhere, so a needed authorization deletes the tokens instead.
export type ConnectionOAuthMode =
  | { kind: 'start' }
  | { kind: 'callback'; codeVerifier: string }
  | { kind: 'client'; onAuthorizationLost: () => void };

// The MCP SDK's OAuth storage and redirect surface for one connection (T21).
// It reads the stored state once and keeps it in memory, and writes every
// change through ConnectionOAuthService.
export class ConnectionOAuthProvider implements OAuthClientProvider {
  // Set by `start`: where to send the owner, and the state it carries.
  authorizationUrl?: URL;
  lastState?: string;
  private verifier?: string;
  private loaded?: Promise<ConnectionOAuthState>;
  // Set only when OneDoor registers itself (OAUTH_DCR). Without it the SDK
  // uses the client from clientInformation() and never registers.
  saveClientInformation?: (
    client: StoredOAuthClientInformation,
  ) => Promise<void>;

  // `client` is the OAuth app the owner registered (OAUTH_MANUAL). Without
  // it, OneDoor registers its own client (OAUTH_DCR).
  constructor(
    private readonly connectionId: string,
    private readonly ownerId: string,
    private readonly store: ConnectionOAuthService,
    private readonly callbackUrl: string,
    private readonly mode: ConnectionOAuthMode,
    private readonly client?: OAuthClientInformation,
  ) {
    if (mode.kind === 'callback') this.verifier = mode.codeVerifier;
    if (!client) {
      this.saveClientInformation = async (registered) => {
        (await this.stored()).client = registered;
        await this.store.saveClient(
          this.connectionId,
          this.ownerId,
          registered,
        );
      };
    }
  }

  get redirectUrl(): string {
    return this.callbackUrl;
  }

  // A public client with PKCE: OneDoor registers without a client secret.
  get clientMetadata(): OAuthClientMetadata {
    return {
      client_name: 'OneDoor',
      redirect_uris: [this.callbackUrl],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
    };
  }

  // A new random state per authorization; the callback looks the flow up by
  // it, which is the CSRF check.
  state(): string {
    this.lastState = randomBytes(32).toString('base64url');
    return this.lastState;
  }

  async clientInformation(): Promise<StoredOAuthClientInformation | undefined> {
    return this.client ?? (await this.stored()).client;
  }

  async tokens(): Promise<StoredOAuthTokens | undefined> {
    return (await this.stored()).tokens;
  }

  async saveTokens(tokens: StoredOAuthTokens): Promise<void> {
    (await this.stored()).tokens = tokens;
    await this.store.saveTokens(
      this.connectionId,
      this.ownerId,
      tokens,
      this.mode.kind === 'callback',
    );
  }

  async redirectToAuthorization(url: URL): Promise<void> {
    if (this.mode.kind === 'start') {
      this.authorizationUrl = url;
      return;
    }
    // No user is there to send. The tokens no longer work, so they go, and
    // the connection asks its owner to authorize again.
    await this.invalidateCredentials('tokens');
    if (this.mode.kind === 'client') this.mode.onAuthorizationLost();
  }

  saveCodeVerifier(codeVerifier: string): void {
    this.verifier = codeVerifier;
  }

  codeVerifier(): string {
    if (!this.verifier) throw new Error('No code verifier for this flow');
    return this.verifier;
  }

  // Exposed for OAuthService, which stores it with the pending flow.
  get savedCodeVerifier(): string | undefined {
    return this.verifier;
  }

  async saveDiscoveryState(discovery: OAuthDiscoveryState): Promise<void> {
    (await this.stored()).discovery = discovery;
    await this.store.saveDiscovery(this.connectionId, this.ownerId, discovery);
  }

  async discoveryState(): Promise<OAuthDiscoveryState | undefined> {
    return (await this.stored()).discovery;
  }

  async invalidateCredentials(
    scope: 'all' | 'client' | 'tokens' | 'verifier' | 'discovery',
  ): Promise<void> {
    const state = await this.stored();
    const all = scope === 'all';
    if (all || scope === 'verifier') this.verifier = undefined;
    const parts = {
      client: all || scope === 'client',
      tokens: all || scope === 'tokens',
      discovery: all || scope === 'discovery',
    };
    if (parts.client) state.client = undefined;
    if (parts.tokens) state.tokens = undefined;
    if (parts.discovery) state.discovery = undefined;
    if (parts.client || parts.tokens || parts.discovery) {
      await this.store.clear(this.connectionId, parts);
    }
  }

  private stored(): Promise<ConnectionOAuthState> {
    this.loaded ??= this.store.load(this.connectionId);
    return this.loaded;
  }
}
