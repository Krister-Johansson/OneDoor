import { InternalError } from '../../../errors/domain-errors.js';
import { AuthType } from '../../../generated/prisma/enums.js';
import type { ConnectionOAuthService } from './oauth/connection-oauth.service.js';
import { ConnectionOAuthProvider } from './oauth/connection-oauth-provider.js';
import type {
  UpstreamAuth,
  UpstreamAuthHooks,
  UpstreamAuthTarget,
} from './upstream-auth.interface.js';
import { UpstreamAuthProvider } from './upstream-auth-provider.js';

// The OAuth types: the MCP SDK sends the stored access token and refreshes
// it through ConnectionOAuthProvider. OAUTH_DCR uses the client OneDoor
// registered (T21); OAUTH_MANUAL uses the OAuth app the owner entered (T22).
// When the authorization server refuses the refresh, the tokens are deleted
// and the registry is told.
export class OAuthAuthProvider extends UpstreamAuthProvider {
  constructor(
    readonly authType: typeof AuthType.OAUTH_DCR | typeof AuthType.OAUTH_MANUAL,
    private readonly store: ConnectionOAuthService,
    private readonly callbackUrl: string,
  ) {
    super();
  }

  // A new authorization or other client details open a new client; a
  // refresh does not.
  fingerprint(target: UpstreamAuthTarget): string {
    return JSON.stringify([
      target.oauthAuthorizedAt?.toISOString() ?? null,
      target.oauthClientId,
      target.oauthClientSecret?.keyId ?? null,
      target.oauthClientSecret?.ciphertext ?? null,
    ]);
  }

  async authenticate(
    target: UpstreamAuthTarget,
    hooks: UpstreamAuthHooks,
  ): Promise<UpstreamAuth> {
    let client: Awaited<ReturnType<ConnectionOAuthService['manualClient']>> =
      null;
    if (this.authType === AuthType.OAUTH_MANUAL) {
      client = await this.store.manualClient(target.connectionId);
      if (!client) {
        throw new InternalError({
          cause: new Error(
            `Connection ${target.connectionId} has no OAuth client id`,
          ),
        });
      }
    }
    return {
      headers: {},
      sensitiveHeaders: [],
      authProvider: new ConnectionOAuthProvider(
        target.connectionId,
        target.ownerId,
        this.store,
        this.callbackUrl,
        { kind: 'client', onAuthorizationLost: () => hooks.credentialsLost() },
        client ?? undefined,
      ),
    };
  }
}
