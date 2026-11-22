import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `events` namespace.
export const eventsEnvSchema = z.object({
  // Which EventBus implementation to bind. Redis comes from REDIS_URL.
  EVENT_BUS: z.enum(['redis']).default('redis'),
});

export const eventsConfig = registerAs('events', () => {
  const env = eventsEnvSchema.parse(process.env);
  return { eventBus: env.EVENT_BUS };
});
