import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { seed } from '../prisma/seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { UpstreamRegistryService } from '../src/services/upstreams/registry/upstream-registry.service.js';
import { startMigratedPostgres } from './support/database.js';
import { stubAppEnv } from './support/env.js';
import { startOpenTwin, type Twin } from './twins/mcp-twins.js';

// The same image as docker-compose.yml.
const REDIS_IMAGE = 'redis:8.8.4-alpine';

// Nothing listens on port 1, so a connect there fails at once.
const DEAD_URL = 'http://127.0.0.1:1/mcp';

describe('upstream registry (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let twin: Twin;
  // Status events and tool syncs go through Redis.
  let redis: StartedRedisContainer;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;
  let meId: string;
  let atStartupId: string;
  let disabledAtStartupId: string;
  let deadAtStartupId: string;
  let closed = false;

  async function graphql(query: string, variables: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    const body = res.body as {
      data?: Record<string, { id: string } | string> | null;
      errors?: unknown[];
    };
    expect(body.errors).toBeUndefined();
    return body.data ?? {};
  }

  function setEnabled(id: string, enabled: boolean) {
    return graphql(
      'mutation ($id: ID!, $enabled: Boolean!) { setConnectionEnabled(id: $id, enabled: $enabled) { id } }',
      { id, enabled },
    );
  }

  // The registry connects in the background, so the tests wait for the
  // client to appear or go.
  function eventually(check: () => void) {
    return vi.waitFor(check, { timeout: 5_000, interval: 20 });
  }

  async function toolNames(id: string): Promise<string[]> {
    const client = registry.client(id);
    if (!client) throw new Error(`No client for connection ${id}`);
    const { tools } = await client.listTools();
    return tools.map((tool) => tool.name).sort();
  }

  function addConnection(displayName: string, url: string, enabled = true) {
    return prisma.connection.create({
      data: { ownerId: meId, displayName, url, authType: 'NONE', enabled },
    });
  }

  beforeAll(async () => {
    [postgres, redis, twin] = await Promise.all([
      startMigratedPostgres(),
      new RedisContainer(REDIS_IMAGE).start(),
      startOpenTwin(),
    ]);
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    meId = (await prisma.user.findUniqueOrThrow({ where: { name: 'me' } })).id;
    atStartupId = (await addConnection('At startup', twin.url)).id;
    disabledAtStartupId = (
      await addConnection('Disabled at startup', twin.url, false)
    ).id;
    deadAtStartupId = (await addConnection('Dead at startup', DEAD_URL)).id;

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
    await app.init();
    registry = app.get(UpstreamRegistryService);
  }, 120_000);

  afterAll(async () => {
    if (!closed) await app?.close();
    await prisma?.$disconnect();
    await Promise.allSettled([twin?.close(), redis?.stop(), postgres?.stop()]);
    vi.unstubAllEnvs();
  });

  it('connects every enabled and READY connection after startup', async () => {
    await eventually(() => expect(registry.client(atStartupId)).toBeDefined());
    expect(await toolNames(atStartupId)).toEqual(['echo', 'reverse']);
    expect(registry.status(atStartupId)).toBe('CONNECTED');
    expect(registry.client(disabledAtStartupId)).toBeUndefined();
    expect(registry.status(disabledAtStartupId)).toBe('OFF');
  });

  it('leaves a connection without a client when its server cannot be reached', async () => {
    await registry.sync(deadAtStartupId);
    expect(registry.client(deadAtStartupId)).toBeUndefined();
    expect(registry.status(deadAtStartupId)).toBe('FAILED');
  });

  it('closes the client when the connection is disabled, and connects again when it is enabled (REQ-CONN-051)', async () => {
    await eventually(() => expect(registry.client(atStartupId)).toBeDefined());
    const before = registry.client(atStartupId);

    await setEnabled(atStartupId, false);
    await eventually(() =>
      expect(registry.client(atStartupId)).toBeUndefined(),
    );
    expect(registry.status(atStartupId)).toBe('OFF');

    await setEnabled(atStartupId, true);
    await eventually(() => expect(registry.client(atStartupId)).toBeDefined());
    expect(registry.client(atStartupId)).not.toBe(before);
    expect(await toolNames(atStartupId)).toEqual(['echo', 'reverse']);
  });

  it('connects a server when it is added', async () => {
    const data = await graphql(
      'mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }',
      { input: { displayName: 'Added', url: twin.url, authType: 'NONE' } },
    );
    const { id } = data.createConnection as { id: string };
    await eventually(() => expect(registry.client(id)).toBeDefined());
  });

  it('reconnects when the URL changes', async () => {
    const { id } = await addConnection('Moving', twin.url);
    await registry.sync(id);
    expect(registry.client(id)).toBeDefined();

    await graphql(
      'mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }',
      { id, input: { url: DEAD_URL } },
    );
    await eventually(() => expect(registry.client(id)).toBeUndefined());

    await graphql(
      'mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }',
      { id, input: { url: twin.url } },
    );
    await eventually(() => expect(registry.client(id)).toBeDefined());
  });

  it('closes the client when the connection is removed (REQ-CONN-052)', async () => {
    const { id } = await addConnection('Removed', twin.url);
    await registry.sync(id);
    expect(registry.client(id)).toBeDefined();

    await graphql('mutation ($id: ID!) { removeConnection(id: $id) }', { id });
    await eventually(() => expect(registry.client(id)).toBeUndefined());
  });

  it('follows a catalog entry switched on and off (REQ-CONN-051)', async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        key: 'registry-twin',
        displayName: 'Registry Twin',
        authOptions: { create: { authType: 'NONE', url: twin.url } },
      },
    });
    const data = await graphql(
      'mutation ($catalogEntryId: ID!) { switchOnCatalogEntry(catalogEntryId: $catalogEntryId, authType: NONE) { id } }',
      { catalogEntryId: entry.id },
    );
    const { id } = data.switchOnCatalogEntry as { id: string };
    await eventually(() => expect(registry.client(id)).toBeDefined());

    await setEnabled(id, false);
    await eventually(() => expect(registry.client(id)).toBeUndefined());
  });

  it('ends with the last change when changes come quickly', async () => {
    const { id } = await addConnection('Flapping', twin.url, false);
    // Each mutation returns before its client connects or closes.
    await setEnabled(id, true);
    await setEnabled(id, false);
    await setEnabled(id, true);
    await setEnabled(id, false);
    await registry.sync(id);
    expect(registry.client(id)).toBeUndefined();
  });

  it('closes every client on shutdown', async () => {
    await eventually(() => expect(registry.client(atStartupId)).toBeDefined());
    const client = registry.client(atStartupId);

    await app.close();
    closed = true;
    expect(registry.client(atStartupId)).toBeUndefined();
    // A closed client has no transport left to send on.
    await expect(client?.ping()).rejects.toThrow();
  });
});
