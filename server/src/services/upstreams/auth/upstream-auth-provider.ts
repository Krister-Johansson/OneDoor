import type { AuthType } from '../../../generated/prisma/enums.js';
import type {
  UpstreamAuth,
  UpstreamAuthHooks,
  UpstreamAuthTarget,
} from './upstream-auth.interface.js';

// Authenticates OneDoor's client to an upstream server, for one auth type
// (REQ-CONN-040). The registry picks the provider by the connection's auth
// type through UpstreamAuthProviders.
export abstract class UpstreamAuthProvider {
  abstract readonly authType: AuthType;

  // Changes whenever the stored credentials or their settings change, so the
  // registry reopens the client. Built from stored values only, never from a
  // plaintext secret.
  abstract fingerprint(target: UpstreamAuthTarget): string;

  // The headers, or the OAuth provider, for the client. Throws InternalError
  // when a stored secret cannot be decrypted; the error never contains the
  // secret.
  abstract authenticate(
    target: UpstreamAuthTarget,
    hooks: UpstreamAuthHooks,
  ): Promise<UpstreamAuth>;
}
