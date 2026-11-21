import { randomBytes } from 'node:crypto';
import { cryptoConfig } from './crypto.config.js';

const KEY = randomBytes(32).toString('base64');

describe('cryptoConfig', () => {
  beforeEach(() => {
    vi.stubEnv('SECRET_STORE', undefined);
    vi.stubEnv('SECRET_STORE_KEY_ID', 'test-1');
    vi.stubEnv('SECRET_STORE_KEY', KEY);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the AES-256-GCM store and decodes the key', () => {
    const config = cryptoConfig();
    expect(config.secretStore).toBe('aes-256-gcm');
    expect(config.keyId).toBe('test-1');
    expect(config.key.equals(Buffer.from(KEY, 'base64'))).toBe(true);
  });

  it.each([
    ['missing', undefined],
    ['not base64', 'not base64!'],
    ['16 bytes', randomBytes(16).toString('base64')],
    ['33 bytes', randomBytes(33).toString('base64')],
  ])('rejects a key that is %s', (_name, value) => {
    vi.stubEnv('SECRET_STORE_KEY', value);
    expect(() => cryptoConfig()).toThrow();
  });

  it('does not put the key in the error message', () => {
    const shortKey = randomBytes(16).toString('base64');
    vi.stubEnv('SECRET_STORE_KEY', shortKey);
    expect(() => cryptoConfig()).toThrow(
      expect.objectContaining({
        message: expect.not.stringContaining(shortKey),
      }),
    );
  });

  it.each([
    ['missing', undefined],
    ['empty', ''],
    ['with a space', 'key 1'],
  ])('rejects a key id that is %s', (_name, value) => {
    vi.stubEnv('SECRET_STORE_KEY_ID', value);
    expect(() => cryptoConfig()).toThrow();
  });

  it('rejects an unknown store', () => {
    vi.stubEnv('SECRET_STORE', 'plaintext');
    expect(() => cryptoConfig()).toThrow();
  });
});
