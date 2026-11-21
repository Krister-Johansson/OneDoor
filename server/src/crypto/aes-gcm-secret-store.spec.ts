import { createDecipheriv, randomBytes } from 'node:crypto';
import { InternalError } from '../errors/domain-errors.js';
import { AesGcmSecretStore } from './aes-gcm-secret-store.js';

const KEY = randomBytes(32);
const CONTEXT = 'connection:0190c3c8-0000-7000-8000-000000000001:api_key';
const SECRET = 'ghp_example-secret-value';

describe('AesGcmSecretStore', () => {
  const store = new AesGcmSecretStore(KEY, 'test-1');

  it('decrypts what it encrypted', async () => {
    const encrypted = await store.encrypt(SECRET, CONTEXT);
    expect(encrypted.keyId).toBe('test-1');
    await expect(store.decrypt(encrypted, CONTEXT)).resolves.toBe(SECRET);
  });

  it('round-trips an empty string and non-ASCII text', async () => {
    for (const value of ['', 'nyckel-åäö-🔑']) {
      const encrypted = await store.encrypt(value, CONTEXT);
      await expect(store.decrypt(encrypted, CONTEXT)).resolves.toBe(value);
    }
  });

  it('never stores the plaintext and uses a new IV every time', async () => {
    const first = await store.encrypt(SECRET, CONTEXT);
    const second = await store.encrypt(SECRET, CONTEXT);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(
      Buffer.from(first.ciphertext, 'base64').toString('latin1'),
    ).not.toContain(SECRET);
  });

  it('stores base64 of IV, ciphertext and tag that plain node:crypto can read', async () => {
    const { ciphertext } = await store.encrypt(SECRET, CONTEXT);
    const data = Buffer.from(ciphertext, 'base64');
    expect(data.length).toBe(12 + Buffer.byteLength(SECRET) + 16);

    const decipher = createDecipheriv('aes-256-gcm', KEY, data.subarray(0, 12));
    decipher.setAAD(Buffer.from(CONTEXT));
    decipher.setAuthTag(data.subarray(data.length - 16));
    const plaintext = Buffer.concat([
      decipher.update(data.subarray(12, data.length - 16)),
      decipher.final(),
    ]).toString('utf8');
    expect(plaintext).toBe(SECRET);
  });

  it.each([
    [
      'another context',
      async () =>
        store.decrypt(await store.encrypt(SECRET, CONTEXT), `${CONTEXT}x`),
    ],
    [
      'another key',
      async () =>
        new AesGcmSecretStore(randomBytes(32), 'test-1').decrypt(
          await store.encrypt(SECRET, CONTEXT),
          CONTEXT,
        ),
    ],
    [
      'an unknown key id',
      async () =>
        store.decrypt(
          { ...(await store.encrypt(SECRET, CONTEXT)), keyId: 'test-2' },
          CONTEXT,
        ),
    ],
    [
      'a changed ciphertext',
      async () => {
        const encrypted = await store.encrypt(SECRET, CONTEXT);
        const data = Buffer.from(encrypted.ciphertext, 'base64');
        data[14] = (data[14] ?? 0) ^ 1;
        return store.decrypt(
          { ...encrypted, ciphertext: data.toString('base64') },
          CONTEXT,
        );
      },
    ],
    [
      'a truncated ciphertext',
      async () =>
        store.decrypt({ keyId: 'test-1', ciphertext: 'AAAA' }, CONTEXT),
    ],
  ])(
    'refuses to decrypt with %s, without the plaintext in the error',
    async (_name, attempt) => {
      const error = await attempt().catch((e: unknown) => e);
      expect(error).toBeInstanceOf(InternalError);
      const text = `${String(error)} ${String((error as InternalError).cause)}`;
      expect(text).not.toContain(SECRET);
    },
  );

  it('refuses a key that is not 32 bytes', () => {
    expect(() => new AesGcmSecretStore(randomBytes(16), 'test-1')).toThrow();
  });
});
