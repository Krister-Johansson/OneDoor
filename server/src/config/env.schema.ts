import { z } from 'zod';
import { appEnvSchema } from './app.config.js';

// Validated by ConfigModule at startup. Add each namespace's schema here.
export const envSchema = z.object({
  ...appEnvSchema.shape,
});
