import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `app` namespace.
export const appEnvSchema = z.object({
  // Keep the default on localhost: the MCP endpoint has no caller auth yet.
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export const appConfig = registerAs('app', () => {
  const env = appEnvSchema.parse(process.env);
  return { host: env.HOST, port: env.PORT };
});
