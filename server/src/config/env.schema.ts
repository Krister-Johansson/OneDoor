import { z } from 'zod';
import { appEnvSchema } from './app.config.js';
import { cryptoEnvSchema } from './crypto.config.js';
import { databaseEnvSchema } from './database.config.js';
import { iconsEnvSchema } from './icons.config.js';
import { redisEnvSchema } from './redis.config.js';

// Validated by ConfigModule at startup. Add each namespace's schema here.
export const envSchema = z.object({
  ...appEnvSchema.shape,
  ...cryptoEnvSchema.shape,
  ...databaseEnvSchema.shape,
  ...iconsEnvSchema.shape,
  ...redisEnvSchema.shape,
});
