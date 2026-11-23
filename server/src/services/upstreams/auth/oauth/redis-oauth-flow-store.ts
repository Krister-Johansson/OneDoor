import type { OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { z } from 'zod';
import type { PendingOAuthFlow } from './oauth.interface.js';
import { OAuthFlowStore } from './oauth-flow-store.js';

const FLOW_SCHEMA = z.object({
  connectionId: z.uuid(),
  ownerId: z.uuid(),
  codeVerifier: z.object({ ciphertext: z.string(), keyId: z.string() }),
});

// OAuthFlowStore on Redis: one key per state with a TTL, read and deleted in
// one GETDEL.
export class RedisOAuthFlowStore
  extends OAuthFlowStore
  implements OnModuleDestroy
{
  readonly id = 'redis';
  private readonly client: Redis;

  constructor(
    url: string,
    private readonly keyPrefix = 'onedoor:oauth-flow:',
  ) {
    super();
    this.client = new Redis(url, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,
    });
  }

  async save(
    state: string,
    flow: PendingOAuthFlow,
    ttlMs: number,
  ): Promise<void> {
    await this.client.set(
      this.keyPrefix + state,
      JSON.stringify(flow),
      'PX',
      ttlMs,
    );
  }

  async take(state: string): Promise<PendingOAuthFlow | null> {
    const value = await this.client.getdel(this.keyPrefix + state);
    if (value === null) return null;
    const parsed = FLOW_SCHEMA.safeParse(JSON.parse(value));
    return parsed.success ? parsed.data : null;
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }
}
