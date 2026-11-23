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
import { startApiKeyTwin, type Twin } from './twins/mcp-twins.js';

// The same image as docker-compose.yml.
const REDIS_IMAGE = 'redis:8.8.4-alpine';
// The API key twin's default: `Authorization: Bearer twin-key`.
const TWIN_KEY = 'twin-key';

describe('upstream auth with an API key (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;
  let bearerTwin: Twin;
  let headerTwin: Twin;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;

  async function graphql(query: string, variables: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    const body = res.body as {
      data?: Record<string, { id: string }>;
      errors?: unknown[];
    };
    expect(body.errors).toBeUndefined();
    return body.data ?? {};
  }

  async function createApiKeyConnection(input: Record<string, unknown>) {
    const data = await graphql(
      'mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }',
      { input: { authType: 'API_KEY', ...input } },
    );
    const id = data.createConnection?.id;
    if (!id) throw new Error('No connection was created');
    return id;
  }

  // Changes the key and waits until the registry has acted on it.
  async function setApiKey(id: string, apiKey: string) {
    await graphql(
      'mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }',
      { id, input: { apiKey } },
    );
    await registry.sync(id);
  }

  function toolCount(connectionId: string) {
    return prisma.tool.count({ where: { connectionId } });
  }

  beforeAll(async () => {
    [postgres, redis, bearerTwin, headerTwin] = await Promise.all([
      startMigratedPostgres(),
      new RedisContainer(REDIS_IMAGE).start(),
      startApiKeyTwin(),
      startApiKeyTwin('x-api-key', 'plain-key'),
    ]);
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);

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
    await app?.close();
    await prisma?.$disconnect();
    await Promise.allSettled([
      bearerTwin?.close(),
      headerTwin?.close(),
      redis?.stop(),
      postgres?.stop(),
    ]);
    vi.unstubAllEnvs();
  });

  it('connects with the stored key and syncs the tools (T20, REQ-CONN-040)', async () => {
    const id = await createApiKeyConnection({
      displayName: 'Bearer twin',
      url: bearerTwin.url,
      apiKey: TWIN_KEY,
    });
    await registry.sync(id);
    expect(registry.status(id)).toBe('CONNECTED');
    await vi.waitFor(async () => expect(await toolCount(id)).toBe(6), {
      timeout: 10_000,
      interval: 50,
    });
  });

  it('sends the key alone in a custom header with an empty prefix (REQ-CONN-040)', async () => {
    const id = await createApiKeyConnection({
      displayName: 'Header twin',
      url: headerTwin.url,
      apiKey: 'plain-key',
      headerName: 'X-Api-Key',
      headerPrefix: '',
    });
    await registry.sync(id);
    expect(registry.status(id)).toBe('CONNECTED');
  });

  it('shows REFUSED_CREDENTIALS for a wrong key and reconnects when the key changes (T20)', async () => {
    const id = await createApiKeyConnection({
      displayName: 'Changing key',
      url: bearerTwin.url,
      apiKey: 'wrong-key',
    });
    await registry.sync(id);
    expect(registry.status(id)).toBe('REFUSED_CREDENTIALS');
    const status = await graphql(
      'query ($id: ID!) { connection(id: $id) { status } }',
      { id },
    );
    expect(status.connection).toEqual({ status: 'REFUSED_CREDENTIALS' });

    await setApiKey(id, TWIN_KEY);
    expect(registry.status(id)).toBe('CONNECTED');

    // A connected client is reopened with the new key, not kept.
    await setApiKey(id, 'wrong-again');
    expect(registry.status(id)).toBe('REFUSED_CREDENTIALS');
  });

  it("uses the catalog option's header settings for a catalog-based connection (T20)", async () => {
    const entry = await prisma.catalogEntry.create({
      data: {
        key: 'header-twin',
        displayName: 'Header Twin Catalog',
        description: 'A catalog entry for the header twin',
        authOptions: {
          create: {
            authType: 'API_KEY',
            url: headerTwin.url,
            headerName: 'X-Api-Key',
            headerPrefix: '',
          },
        },
      },
    });
    const data = await graphql(
      'mutation ($id: ID!) { switchOnCatalogEntry(catalogEntryId: $id, authType: API_KEY) { id } }',
      { id: entry.id },
    );
    const id = data.switchOnCatalogEntry?.id;
    if (!id) throw new Error('The entry was not switched on');
    await registry.sync(id);
    // NEEDS_CREDENTIALS: no client until a key is stored.
    expect(registry.status(id)).toBe('OFF');

    await setApiKey(id, 'plain-key');
    expect(registry.status(id)).toBe('CONNECTED');
  });

  it('never stores or returns the plaintext key (REQ-CONN-041)', async () => {
    const rows = await prisma.connection.findMany();
    expect(rows.length).toBeGreaterThan(0);
    expect(JSON.stringify(rows)).not.toContain(TWIN_KEY);
    expect(JSON.stringify(rows)).not.toContain('plain-key');
  });
});
