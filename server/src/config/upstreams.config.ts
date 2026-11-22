import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `upstreams` namespace.
export const upstreamsEnvSchema = z.object({
  // Whether the server keeps clients connected to the upstream MCP servers of
  // enabled connections. Tests turn it off, so no test reaches the network by
  // accident.
  UPSTREAM_CONNECTING: z.stringbool().default(true),
});

export const upstreamsConfig = registerAs('upstreams', () => {
  const env = upstreamsEnvSchema.parse(process.env);
  return { connecting: env.UPSTREAM_CONNECTING };
});
