import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { cryptoConfig } from '../config/crypto.config.js';
import { AesGcmSecretStore } from './aes-gcm-secret-store.js';
import { SecretStore } from './secret-store.js';

@Module({
  providers: [
    {
      // Feature code injects the abstract class; config picks the implementation.
      provide: SecretStore,
      inject: [cryptoConfig.KEY],
      useFactory: (crypto: ConfigType<typeof cryptoConfig>): SecretStore => {
        switch (crypto.secretStore) {
          case 'aes-256-gcm':
            return new AesGcmSecretStore(crypto.key, crypto.keyId);
        }
      },
    },
  ],
  exports: [SecretStore],
})
export class CryptoModule {}
