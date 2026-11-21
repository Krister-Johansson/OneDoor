import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `redis` namespace.
export const redisEnvSchema = z.object({
  // The development Redis has no password. A URL with a password is a secret.
  REDIS_URL: z.url({ protocol: /^rediss?$/ }).default('redis://127.0.0.1:6379'),
});

export const redisConfig = registerAs('redis', () => {
  const env = redisEnvSchema.parse(process.env);
  return { url: env.REDIS_URL };
});
