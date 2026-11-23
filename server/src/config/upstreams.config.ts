import { registerAs } from '@nestjs/config';
import { z } from 'zod';

// Environment variables owned by the `upstreams` namespace.
export const upstreamsEnvSchema = z.object({
  // Whether the server keeps clients connected to the upstream MCP servers of
  // enabled connections. Tests turn it off, so no test reaches the network by
  // accident.
  UPSTREAM_CONNECTING: z.stringbool().default(true),
  // Where an authorization server sends the browser back after the owner
  // authorizes OneDoor (T21). The web server forwards this path to the API.
  // The owner is then sent to the server's page on the same origin.
  OAUTH_REDIRECT_URL: z
    .url({ protocol: /^https?$/ })
    .default('http://localhost:3001/oauth/callback'),
});

export const upstreamsConfig = registerAs('upstreams', () => {
  const env = upstreamsEnvSchema.parse(process.env);
  return {
    connecting: env.UPSTREAM_CONNECTING,
    oauthRedirectUrl: env.OAUTH_REDIRECT_URL,
  };
});
