import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `icons` namespace.
export const iconsEnvSchema = z.object({
  // Whether the server fetches server icons (REQ-CONN-070). Tests turn it
  // off, so no test reaches the network by accident.
  ICON_FETCHING: z.stringbool().default(true),
});

export const iconsConfig = registerAs('icons', () => {
  const env = iconsEnvSchema.parse(process.env);
  return { fetching: env.ICON_FETCHING };
});
