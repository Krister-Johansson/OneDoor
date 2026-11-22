import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { type Client, createClient } from 'graphql-ws';
import { Redis } from 'ioredis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { WebSocket } from 'ws';
import { seed } from '../prisma/seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { UpstreamRegistryService } from '../src/services/upstreams/registry/upstream-registry.service.js';
import { startMigratedPostgres } from './support/database.js';
import { stubAppEnv } from './support/env.js';
import { startOpenTwin, type Twin } from './twins/mcp-twins.js';

// The same image as docker-compose.yml.
const REDIS_IMAGE = 'redis:8.8.4-alpine';
const STATUS_CHANNEL = 'onedoor:connection-status-changed';
const SUBSCRIPTION =
  'subscription { connectionStatusChanged { id displayName status } }';

interface StatusEvent {
  data?: {
    connectionStatusChanged: {
      id: string;
      displayName: string;
      status: string;
    };
  };
  errors?: unknown[];
}

describe('connection status (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let inspector: Redis;
  let prisma: PrismaClient;
  let twin: Twin;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;
  let wsUrl: string;
  let mineId: string;
  let theirsId: string;
  const clients: Client[] = [];

  async function graphql(query: string, variables?: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    const body = res.body as {
      data?: Record<string, unknown>;
      errors?: unknown[];
    };
    expect(body.errors).toBeUndefined();
    return body.data ?? {};
  }

  async function statusOf(id: string): Promise<string> {
    const data = await graphql(
      'query ($id: ID!) { connection(id: $id) { status } }',
      { id },
    );
    return (data.connection as { status: string }).status;
  }

  function setEnabled(id: string, enabled: boolean) {
    return graphql(
      'mutation ($id: ID!, $enabled: Boolean!) { setConnectionEnabled(id: $id, enabled: $enabled) { id } }',
      { id, enabled },
    );
  }

  // Subscribes and waits until the server holds the Redis subscription, so
  // no event published afterwards is missed. The server shares one Redis
  // subscription between sockets, so this first waits for the earlier
  // tests' subscriptions to end.
  async function subscribe(): Promise<AsyncIterableIterator<StatusEvent>> {
    await waitForSubscriptions(0);
    const client = createClient({ url: wsUrl, webSocketImpl: WebSocket });
    clients.push(client);
    const events = client.iterate<StatusEvent['data']>({
      query: SUBSCRIPTION,
    }) as AsyncIterableIterator<StatusEvent>;
    // iterate() subscribes on the first next(); start it now.
    let first: Promise<IteratorResult<StatusEvent>> | undefined = events.next();
    await waitForSubscriptions(1);
    const wrapped: AsyncIterableIterator<StatusEvent> = {
      next: () => {
        const pending = first ?? events.next();
        first = undefined;
        return pending;
      },
      return: async () => {
        await events.return?.();
        return { value: undefined, done: true };
      },
      [Symbol.asyncIterator]: () => wrapped,
    };
    return wrapped;
  }

  function waitForSubscriptions(count: number) {
    return vi.waitFor(
      async () => expect(await redisSubscriptions()).toBe(count),
      { timeout: 5_000, interval: 20 },
    );
  }

  async function redisSubscriptions(): Promise<number> {
    const reply = (await inspector.pubsub('NUMSUB', STATUS_CHANNEL)) as [
      string,
      number,
    ];
    return reply[1];
  }

  // Reads events until one for `id` has `status`, and returns every
  // status seen for `id` on the way.
  async function statusesUntil(
    events: AsyncIterableIterator<StatusEvent>,
    id: string,
    status: string,
  ): Promise<{ statuses: string[]; otherIds: string[] }> {
    const statuses: string[] = [];
    const otherIds: string[] = [];
    while (true) {
      const { value, done } = await events.next();
      if (done) throw new Error('The subscription ended');
      expect(value.errors).toBeUndefined();
      const changed = value.data?.connectionStatusChanged;
      if (!changed) throw new Error('An event without data');
      if (changed.id !== id) {
        otherIds.push(changed.id);
        continue;
      }
      statuses.push(changed.status);
      if (changed.status === status) return { statuses, otherIds };
    }
  }

  // Opens a raw graphql-ws socket with the given Origin and returns the
  // first message type, or the close code when the server refuses it.
  function handshake(origin: string): Promise<string | number> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(wsUrl, 'graphql-transport-ws', { origin });
      socket.on('open', () =>
        socket.send(JSON.stringify({ type: 'connection_init' })),
      );
      socket.on('message', (data) => {
        resolve((JSON.parse(String(data)) as { type: string }).type);
        socket.close();
      });
      socket.on('close', (code) => resolve(code));
      socket.on('error', reject);
    });
  }

  beforeAll(async () => {
    [postgres, redis, twin] = await Promise.all([
      startMigratedPostgres(),
      new RedisContainer(REDIS_IMAGE).start(),
      startOpenTwin(),
    ]);
    inspector = new Redis(redis.getConnectionUrl());
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    const me = await prisma.user.findUniqueOrThrow({ where: { name: 'me' } });
    const other = await prisma.user.create({ data: { name: 'other' } });
    mineId = (
      await prisma.connection.create({
        data: {
          ownerId: me.id,
          displayName: 'Mine',
          url: twin.url,
          authType: 'NONE',
          enabled: false,
        },
      })
    ).id;
    theirsId = (
      await prisma.connection.create({
        data: {
          ownerId: other.id,
          displayName: 'Theirs',
          url: twin.url,
          authType: 'NONE',
          enabled: false,
        },
      })
    ).id;

    stubAppEnv({
      DATABASE_URL: postgres.getConnectionUri(),
      REDIS_URL: redis.getConnectionUrl(),
    });
    vi.stubEnv('UPSTREAM_CONNECTING', 'true');
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.listen(0, '127.0.0.1');
    wsUrl = `${(await app.getUrl()).replace(/^http/, 'ws')}/graphql`;
    registry = app.get(UpstreamRegistryService);
  }, 120_000);

  afterAll(async () => {
    await Promise.allSettled(clients.map((client) => client.dispose()));
    await app?.close();
    inspector?.disconnect();
    await prisma?.$disconnect();
    await Promise.allSettled([twin?.close(), redis?.stop(), postgres?.stop()]);
    vi.unstubAllEnvs();
  });

  it('shows OFF for a disabled connection', async () => {
    expect(await statusOf(mineId)).toBe('OFF');
  });

  it("sends the caller's connection each time its status changes, and nothing of other owners", async () => {
    const events = await subscribe();

    await setEnabled(mineId, true);
    // The event carries the id; the resolver reads the status when it sends,
    // so a fast connect can show CONNECTED for both of its events.
    const connecting = await statusesUntil(events, mineId, 'CONNECTED');
    expect(['CONNECTING', 'CONNECTED']).toEqual(
      expect.arrayContaining(connecting.statuses),
    );
    expect(await statusOf(mineId)).toBe('CONNECTED');

    // Another owner's connection connects too, but its events are not sent.
    await prisma.connection.update({
      where: { id: theirsId },
      data: { enabled: true },
    });
    await registry.sync(theirsId);
    expect(registry.status(theirsId)).toBe('CONNECTED');

    await setEnabled(mineId, false);
    const off = await statusesUntil(events, mineId, 'OFF');
    expect(off.otherIds).toEqual([]);

    await events.return?.();
    // Closing the socket ends the server's Redis subscription.
    await waitForSubscriptions(0);
  });

  it('shows FAILED when the server cannot be reached', async () => {
    const events = await subscribe();
    await graphql(
      'mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }',
      { id: mineId, input: { url: 'http://127.0.0.1:1/mcp' } },
    );
    await setEnabled(mineId, true);
    const failed = await statusesUntil(events, mineId, 'FAILED');
    expect(['CONNECTING', 'FAILED']).toEqual(
      expect.arrayContaining(failed.statuses),
    );
    expect(await statusOf(mineId)).toBe('FAILED');
    await events.return?.();
  });

  it('accepts a socket from a page on this machine', async () => {
    await expect(handshake('http://localhost:3001')).resolves.toBe(
      'connection_ack',
    );
  });

  it('refuses a socket from a page on another site', async () => {
    await expect(handshake('https://evil.example')).resolves.toBe(4403);
  });
});
