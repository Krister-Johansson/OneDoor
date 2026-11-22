import { z } from 'zod';
import { appEnvSchema } from './app.config.js';
import { cryptoEnvSchema } from './crypto.config.js';
import { databaseEnvSchema } from './database.config.js';
import { eventsEnvSchema } from './events.config.js';
import { iconsEnvSchema } from './icons.config.js';
import { redisEnvSchema } from './redis.config.js';
import { upstreamsEnvSchema } from './upstreams.config.js';

// Validated by ConfigModule at startup. Add each namespace's schema here.
export const envSchema = z.object({
  ...appEnvSchema.shape,
  ...cryptoEnvSchema.shape,
  ...databaseEnvSchema.shape,
  ...eventsEnvSchema.shape,
  ...iconsEnvSchema.shape,
  ...redisEnvSchema.shape,
  ...upstreamsEnvSchema.shape,
});
