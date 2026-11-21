import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `crypto` namespace: the key that
// SecretStore encrypts secrets with (server/AGENTS.md, Secrets).
export const cryptoEnvSchema = z.object({
  // Which SecretStore implementation to bind.
  SECRET_STORE: z.enum(['aes-256-gcm']).default('aes-256-gcm'),
  // Stored next to every encrypted value, so a later key can replace this one.
  SECRET_STORE_KEY_ID: z
    .string()
    .regex(
      /^[A-Za-z0-9._-]{1,64}$/,
      'Use 1 to 64 letters, digits, ".", "_" or "-"',
    ),
  // A secret: 32 random bytes in base64, for example from `openssl rand -base64 32`.
  SECRET_STORE_KEY: z
    .base64('Must be base64')
    .refine((value) => Buffer.from(value, 'base64').length === 32, {
      message: 'Must decode to exactly 32 bytes',
    }),
});

export const cryptoConfig = registerAs('crypto', () => {
  const env = cryptoEnvSchema.parse(process.env);
  return {
    secretStore: env.SECRET_STORE,
    keyId: env.SECRET_STORE_KEY_ID,
    key: Buffer.from(env.SECRET_STORE_KEY, 'base64'),
  };
});
