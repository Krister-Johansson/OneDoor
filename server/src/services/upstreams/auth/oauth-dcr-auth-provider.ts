import { AuthType } from '../../../generated/prisma/enums.js';
import type { ConnectionOAuthService } from './oauth/connection-oauth.service.js';
import { ConnectionOAuthProvider } from './oauth/connection-oauth-provider.js';
import type {
  UpstreamAuth,
  UpstreamAuthHooks,
  UpstreamAuthTarget,
} from './upstream-auth.interface.js';
import { UpstreamAuthProvider } from './upstream-auth-provider.js';

// OAUTH_DCR: the MCP SDK sends the stored access token and refreshes it
// through ConnectionOAuthProvider (T21). When the authorization server
// refuses the refresh, the tokens are deleted and the registry is told.
export class OAuthDcrAuthProvider extends UpstreamAuthProvider {
  readonly authType = AuthType.OAUTH_DCR;

  constructor(
    private readonly store: ConnectionOAuthService,
    private readonly callbackUrl: string,
  ) {
    super();
  }

  // A new authorization opens a new client; a refresh does not.
  fingerprint(target: UpstreamAuthTarget): string {
    return target.oauthAuthorizedAt?.toISOString() ?? '';
  }

  async authenticate(
    target: UpstreamAuthTarget,
    hooks: UpstreamAuthHooks,
  ): Promise<UpstreamAuth> {
    return {
      headers: {},
      sensitiveHeaders: [],
      authProvider: new ConnectionOAuthProvider(
        target.connectionId,
        target.ownerId,
        this.store,
        this.callbackUrl,
        { kind: 'client', onAuthorizationLost: () => hooks.credentialsLost() },
      ),
    };
  }
}
