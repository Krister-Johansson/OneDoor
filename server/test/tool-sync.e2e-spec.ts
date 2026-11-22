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
const SYNCED_CHANNEL = 'onedoor:connection-tools-synced';

interface SyncedEvent {
  data?: { connectionToolsSynced: { id: string; toolCount: number } };
  errors?: unknown[];
}

describe('tool sync (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let inspector: Redis;
  let prisma: PrismaClient;
  let twin: Twin;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;
  let meId: string;
  let otherId: string;
  let syncedId: string;
  let wsUrl: string;
  const clients: Client[] = [];

  async function graphql(query: string, variables: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    return res.body as {
      data?: Record<string, Record<string, unknown>> | null;
      errors?: { extensions: { code: string } }[];
    };
  }

  function resync(id: string) {
    return graphql(
      'mutation ($id: ID!) { resyncTools(id: $id) { id toolCount } }',
      { id },
    );
  }

  function toolsOf(connectionId: string) {
    return prisma.tool.findMany({
      where: { connectionId },
      orderBy: { name: 'asc' },
    });
  }

  // Syncs run in a BullMQ worker, so the tests wait for their effect.
  function eventually(check: () => Promise<void>) {
    return vi.waitFor(check, { timeout: 10_000, interval: 50 });
  }

  function addConnection(displayName: string, url: string) {
    return prisma.connection.create({
      data: { ownerId: meId, displayName, url, authType: 'NONE' },
    });
  }

  // Subscribes to connectionToolsSynced and waits until the server holds
  // the Redis subscription, so no sync that finishes afterwards is missed.
  async function subscribeToSyncs(): Promise<AsyncIterator<SyncedEvent>> {
    const client = createClient({ url: wsUrl, webSocketImpl: WebSocket });
    clients.push(client);
    const events = client.iterate<SyncedEvent['data']>({
      query: 'subscription { connectionToolsSynced { id toolCount } }',
    }) as AsyncIterableIterator<SyncedEvent>;
    // iterate() subscribes on the first next(); start it now.
    let first: Promise<IteratorResult<SyncedEvent>> | undefined = events.next();
    await vi.waitFor(
      async () => {
        const reply = (await inspector.pubsub('NUMSUB', SYNCED_CHANNEL)) as [
          string,
          number,
        ];
        expect(reply[1]).toBe(1);
      },
      { timeout: 5_000, interval: 20 },
    );
    return {
      next: () => {
        const pending = first ?? events.next();
        first = undefined;
        return pending;
      },
      return: async () => {
        await events.return?.();
        return { value: undefined, done: true };
      },
    };
  }

  // Reads events until one for `id`, and returns it with the ids of the
  // events before it.
  async function syncedEventFor(
    events: AsyncIterator<SyncedEvent>,
    id: string,
  ) {
    const otherIds: string[] = [];
    while (true) {
      const { value, done } = await events.next();
      if (done) throw new Error('The subscription ended');
      expect(value.errors).toBeUndefined();
      const synced = value.data?.connectionToolsSynced;
      if (!synced) throw new Error('An event without data');
      if (synced.id === id) return { toolCount: synced.toolCount, otherIds };
      otherIds.push(synced.id);
    }
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
    meId = (await prisma.user.findUniqueOrThrow({ where: { name: 'me' } })).id;
    otherId = (await prisma.user.create({ data: { name: 'other' } })).id;
    syncedId = (await addConnection('Synced at startup', twin.url)).id;

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

  it('stores the tools of a connection when its client connects', async () => {
    await eventually(async () => {
      const tools = await toolsOf(syncedId);
      expect(tools.map((tool) => tool.name)).toEqual(['echo', 'reverse']);
    });
    const [echo] = await toolsOf(syncedId);
    expect(echo).toMatchObject({
      ownerId: meId,
      description: 'The echo tool of open-twin.',
      contentHash: expect.stringMatching(/^[0-9a-f]{64}$/),
      inputSchema: expect.objectContaining({ type: 'object' }),
      enabled: true,
    });

    const body = await graphql(
      'query ($id: ID!) { connection(id: $id) { toolCount } }',
      { id: syncedId },
    );
    expect(body.data?.connection).toEqual({ toolCount: 2 });
  });

  it("sends the caller's connection with its new tool count when a sync finishes, and nothing of other owners", async () => {
    await eventually(async () =>
      expect(await toolsOf(syncedId)).toHaveLength(2),
    );
    const events = await subscribeToSyncs();

    // Another owner's connection syncs first; its event is not sent.
    const theirs = await prisma.connection.create({
      data: {
        ownerId: otherId,
        displayName: 'Theirs, synced',
        url: twin.url,
        authType: 'NONE',
      },
    });
    await registry.sync(theirs.id);
    await eventually(async () =>
      expect(await toolsOf(theirs.id)).toHaveLength(2),
    );

    // A re-sync stores the tool the server lists again.
    await prisma.tool.deleteMany({
      where: { connectionId: syncedId, name: 'reverse' },
    });
    expect((await resync(syncedId)).errors).toBeUndefined();
    const synced = await syncedEventFor(events, syncedId);
    expect(synced).toEqual({ toolCount: 2, otherIds: [] });

    // A sync that changes nothing is sent too, so the web sees every
    // re-sync end.
    expect((await resync(syncedId)).errors).toBeUndefined();
    expect(await syncedEventFor(events, syncedId)).toEqual({
      toolCount: 2,
      otherIds: [],
    });
    await events.return?.();
  });

  it('rewrites only changed tools, removes tools the server no longer lists, and keeps ids', async () => {
    await eventually(async () =>
      expect(await toolsOf(syncedId)).toHaveLength(2),
    );
    const [echo, reverse] = await toolsOf(syncedId);
    if (!echo || !reverse) throw new Error('The tools were not synced');
    // A stored tool that no longer matches the server, and one the server
    // does not list.
    await prisma.tool.update({
      where: { id: reverse.id },
      data: { description: 'stale', contentHash: 'stale' },
    });
    await prisma.tool.create({
      data: {
        ownerId: meId,
        connectionId: syncedId,
        name: 'gone',
        inputSchema: { type: 'object' },
        contentHash: 'gone',
      },
    });

    const body = await resync(syncedId);
    expect(body.errors).toBeUndefined();

    await eventually(async () => {
      const tools = await toolsOf(syncedId);
      expect(tools.map((tool) => tool.name)).toEqual(['echo', 'reverse']);
      expect(tools[1]?.description).toBe('The reverse tool of open-twin.');
    });
    const [echoAfter, reverseAfter] = await toolsOf(syncedId);
    expect(echoAfter?.id).toBe(echo.id);
    expect(echoAfter?.updatedAt).toEqual(echo.updatedAt);
    expect(reverseAfter?.id).toBe(reverse.id);
    expect(reverseAfter?.contentHash).toBe(reverse.contentHash);
  });

  it('keeps the enabled flag when a sync rewrites a tool (T19)', async () => {
    await eventually(async () =>
      expect(await toolsOf(syncedId)).toHaveLength(2),
    );
    const [echo] = await toolsOf(syncedId);
    if (!echo) throw new Error('The tools were not synced');
    const off = await graphql(
      'mutation ($id: ID!) { setToolEnabled(id: $id, enabled: false) { enabled } }',
      { id: echo.id },
    );
    expect(off.errors).toBeUndefined();
    // A stale hash makes the sync rewrite the row.
    await prisma.tool.update({
      where: { id: echo.id },
      data: { description: 'stale', contentHash: 'stale' },
    });

    expect((await resync(syncedId)).errors).toBeUndefined();
    await eventually(async () => {
      const [synced] = await toolsOf(syncedId);
      expect(synced?.description).toBe('The echo tool of open-twin.');
    });
    const [after] = await toolsOf(syncedId);
    expect(after).toMatchObject({ id: echo.id, enabled: false });

    await graphql(
      'mutation ($id: ID!) { setToolEnabled(id: $id, enabled: true) { enabled } }',
      { id: echo.id },
    );
  });

  it('refuses a re-sync while the connection is not connected', async () => {
    const { id } = await addConnection('Unreachable', 'http://127.0.0.1:1/mcp');
    await registry.sync(id);
    expect(registry.status(id)).toBe('FAILED');

    const body = await resync(id);
    expect(body.errors?.[0]?.extensions.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(await toolsOf(id)).toEqual([]);
  });

  it("refuses a re-sync of another owner's connection", async () => {
    const theirs = await prisma.connection.create({
      data: {
        ownerId: otherId,
        displayName: 'Theirs',
        url: twin.url,
        authType: 'NONE',
      },
    });
    const body = await resync(theirs.id);
    expect(body.errors?.[0]?.extensions.code).toBe('NOT_FOUND');
  });

  it('keeps the tools of a disabled connection and deletes them with the connection (REQ-CONN-051, REQ-CONN-052)', async () => {
    const { id } = await addConnection('Kept', twin.url);
    await registry.sync(id);
    await eventually(async () => expect(await toolsOf(id)).toHaveLength(2));

    await graphql(
      'mutation ($id: ID!) { setConnectionEnabled(id: $id, enabled: false) { id } }',
      { id },
    );
    await registry.sync(id);
    expect(registry.status(id)).toBe('OFF');
    expect(await toolsOf(id)).toHaveLength(2);

    await graphql('mutation ($id: ID!) { removeConnection(id: $id) }', { id });
    expect(await toolsOf(id)).toEqual([]);
  });

  it("stores a tool only under its connection's owner", async () => {
    await expect(
      prisma.tool.create({
        data: {
          ownerId: otherId,
          connectionId: syncedId,
          name: 'mismatched',
          inputSchema: { type: 'object' },
          contentHash: 'x',
        },
      }),
    ).rejects.toThrow(/tool_connection_id_owner_id_fkey/);
  });
});
