import { randomBytes } from 'node:crypto';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { cryptoConfig } from '../config/crypto.config.js';
import { AesGcmSecretStore } from './aes-gcm-secret-store.js';
import { CryptoModule } from './crypto.module.js';
import { SecretStore } from './secret-store.js';

describe('CryptoModule', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('binds SecretStore to the store that SECRET_STORE names', async () => {
    vi.stubEnv('SECRET_STORE', 'aes-256-gcm');
    vi.stubEnv('SECRET_STORE_KEY_ID', 'test-1');
    vi.stubEnv('SECRET_STORE_KEY', randomBytes(32).toString('base64'));

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [cryptoConfig],
        }),
        CryptoModule,
      ],
    }).compile();

    const store = moduleRef.get(SecretStore);
    expect(store).toBeInstanceOf(AesGcmSecretStore);
    const encrypted = await store.encrypt('value', 'test');
    expect(encrypted.keyId).toBe('test-1');
    await expect(store.decrypt(encrypted, 'test')).resolves.toBe('value');
  });
});
