import { AuthType } from '../../../generated/prisma/enums.js';
import type { UpstreamAuth } from './upstream-auth.interface.js';
import { UpstreamAuthProvider } from './upstream-auth-provider.js';

// NONE: the server needs no credentials.
export class NoneAuthProvider extends UpstreamAuthProvider {
  readonly authType = AuthType.NONE;

  fingerprint(): string {
    return '';
  }

  async authenticate(): Promise<UpstreamAuth> {
    return { headers: {}, sensitiveHeaders: [] };
  }
}
