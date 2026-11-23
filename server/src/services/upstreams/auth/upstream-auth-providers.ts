import type { AuthType } from '../../../generated/prisma/enums.js';
import type { UpstreamAuthProvider } from './upstream-auth-provider.js';

// The upstream auth providers, one per supported auth type. UpstreamsModule
// builds it with a factory provider.
export class UpstreamAuthProviders {
  private readonly byType: ReadonlyMap<AuthType, UpstreamAuthProvider>;

  constructor(providers: readonly UpstreamAuthProvider[]) {
    this.byType = new Map(
      providers.map((provider) => [provider.authType, provider]),
    );
  }

  // The provider for an auth type, or undefined when OneDoor cannot
  // authenticate with it yet. A connection without a provider gets no
  // client.
  for(authType: AuthType): UpstreamAuthProvider | undefined {
    return this.byType.get(authType);
  }
}
