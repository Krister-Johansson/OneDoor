import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { InternalError } from '../errors/domain-errors.js';
import { type EncryptedSecret, SecretStore } from './secret-store.js';

const ALGORITHM = 'aes-256-gcm';
const KEY_BYTES = 32;
const IV_BYTES = 12;
const TAG_BYTES = 16;

// AES-256-GCM with a random 96-bit IV per secret and the context as
// additional authenticated data. The stored ciphertext is base64 of
// IV || encrypted bytes || 128-bit tag.
export class AesGcmSecretStore extends SecretStore {
  readonly id = ALGORITHM;

  constructor(
    private readonly key: Buffer,
    private readonly keyId: string,
  ) {
    super();
    if (key.length !== KEY_BYTES) {
      throw new Error(`The ${ALGORITHM} key must be ${KEY_BYTES} bytes`);
    }
  }

  async encrypt(plaintext: string, context: string): Promise<EncryptedSecret> {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv, {
      authTagLength: TAG_BYTES,
    });
    cipher.setAAD(Buffer.from(context, 'utf8'));
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    return {
      keyId: this.keyId,
      ciphertext: Buffer.concat([iv, encrypted, cipher.getAuthTag()]).toString(
        'base64',
      ),
    };
  }

  async decrypt(secret: EncryptedSecret, context: string): Promise<string> {
    if (secret.keyId !== this.keyId) {
      throw new InternalError({
        cause: new Error(`No secret store key with id "${secret.keyId}"`),
      });
    }
    const data = Buffer.from(secret.ciphertext, 'base64');
    if (data.length < IV_BYTES + TAG_BYTES) {
      throw new InternalError({
        cause: new Error('The encrypted secret is too short'),
      });
    }
    const iv = data.subarray(0, IV_BYTES);
    const encrypted = data.subarray(IV_BYTES, data.length - TAG_BYTES);
    const tag = data.subarray(data.length - TAG_BYTES);
    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv, {
        authTagLength: TAG_BYTES,
      });
      decipher.setAAD(Buffer.from(context, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(encrypted),
        decipher.final(),
      ]).toString('utf8');
    } catch {
      // Node's message says only that authentication failed. A fixed message
      // keeps any future detail out of logs.
      throw new InternalError({
        cause: new Error(
          'The encrypted secret failed authentication: wrong key, context or ciphertext',
        ),
      });
    }
  }
}
