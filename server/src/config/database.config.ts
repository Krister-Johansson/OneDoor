import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `database` namespace.
export const databaseEnvSchema = z.object({
  // Holds the password, so it has no default and .env.example leaves it empty.
  DATABASE_URL: z.url({ protocol: /^postgres(ql)?$/ }),
});

export const databaseConfig = registerAs('database', () => {
  const env = databaseEnvSchema.parse(process.env);
  return { url: env.DATABASE_URL };
});
