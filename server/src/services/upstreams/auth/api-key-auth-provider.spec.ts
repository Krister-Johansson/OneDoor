import { randomBytes } from 'node:crypto';
import { AesGcmSecretStore } from '../../../crypto/aes-gcm-secret-store.js';
import { InternalError } from '../../../errors/domain-errors.js';
import { ApiKeyAuthProvider } from './api-key-auth-provider.js';
import type { UpstreamAuthTarget } from './upstream-auth.interface.js';

const ID = '0190c3c8-0000-7000-8000-000000000001';
const CONTEXT = `connection:${ID}:api_key`;

describe('ApiKeyAuthProvider (REQ-CONN-040)', () => {
  const store = new AesGcmSecretStore(randomBytes(32), 'test-1');
  const provider = new ApiKeyAuthProvider(store);

  async function target(
    key: string,
    settings: Partial<UpstreamAuthTarget> = {},
  ): Promise<UpstreamAuthTarget> {
    return {
      connectionId: ID,
      authType: 'API_KEY',
      headerName: 'Authorization',
      headerPrefix: 'Bearer',
      apiKey: await store.encrypt(key, CONTEXT),
      ...settings,
    };
  }

  it('sends the prefix, a space and the key', async () => {
    await expect(provider.authenticate(await target('abc'))).resolves.toEqual({
      headers: { Authorization: 'Bearer abc' },
      sensitiveHeaders: ['Authorization'],
    });
  });

  it('sends the key alone with an empty prefix', async () => {
    const auth = await provider.authenticate(
      await target('abc', { headerName: 'X-Api-Key', headerPrefix: '' }),
    );
    expect(auth.headers).toEqual({ 'X-Api-Key': 'abc' });
    expect(auth.sensitiveHeaders).toEqual(['X-Api-Key']);
  });

  it('uses Authorization and Bearer when no settings are stored', async () => {
    const auth = await provider.authenticate(
      await target('abc', { headerName: null, headerPrefix: null }),
    );
    expect(auth.headers).toEqual({ Authorization: 'Bearer abc' });
  });

  it('refuses a key encrypted for another connection or none at all', async () => {
    const other = await store.encrypt(
      'abc',
      'connection:0190c3c8-0000-7000-8000-000000000002:api_key',
    );
    const moved = { ...(await target('abc')), apiKey: other };
    await expect(provider.authenticate(moved)).rejects.toBeInstanceOf(
      InternalError,
    );
    await expect(
      provider.authenticate({ ...moved, apiKey: null }),
    ).rejects.toBeInstanceOf(InternalError);
  });

  it('changes its fingerprint with the key and the settings, and never contains the key', async () => {
    const first = await target('secret-key-1');
    const fingerprint = provider.fingerprint(first);
    expect(fingerprint).not.toContain('secret-key-1');
    expect(provider.fingerprint(first)).toBe(fingerprint);
    expect(provider.fingerprint(await target('secret-key-1'))).not.toBe(
      fingerprint,
    );
    expect(provider.fingerprint({ ...first, headerPrefix: 'Token' })).not.toBe(
      fingerprint,
    );
    expect(provider.fingerprint({ ...first, headerName: 'X-Key' })).not.toBe(
      fingerprint,
    );
  });
});
