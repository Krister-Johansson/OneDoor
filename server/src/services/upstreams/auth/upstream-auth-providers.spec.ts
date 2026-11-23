import { randomBytes } from 'node:crypto';
import { AesGcmSecretStore } from '../../../crypto/aes-gcm-secret-store.js';
import { ApiKeyAuthProvider } from './api-key-auth-provider.js';
import { NoneAuthProvider } from './none-auth-provider.js';
import { UpstreamAuthProviders } from './upstream-auth-providers.js';

describe('UpstreamAuthProviders', () => {
  const providers = new UpstreamAuthProviders([
    new NoneAuthProvider(),
    new ApiKeyAuthProvider(new AesGcmSecretStore(randomBytes(32), 'test-1')),
  ]);

  it('picks the provider for an auth type', () => {
    expect(providers.for('NONE')).toBeInstanceOf(NoneAuthProvider);
    expect(providers.for('API_KEY')).toBeInstanceOf(ApiKeyAuthProvider);
  });

  it('has none for the OAuth types yet', () => {
    expect(providers.for('OAUTH_DCR')).toBeUndefined();
    expect(providers.for('OAUTH_MANUAL')).toBeUndefined();
  });

  it('sends no headers for NONE', async () => {
    await expect(new NoneAuthProvider().authenticate()).resolves.toEqual({
      headers: {},
      sensitiveHeaders: [],
    });
  });
});
