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
import { type OAuthFlowTwin, startOAuthFlowTwin } from './twins/mcp-twins.js';

// The same image as docker-compose.yml.
const REDIS_IMAGE = 'redis:8.8.4-alpine';
const CALLBACK = 'http://localhost:3001/oauth/callback';

interface ConnectionState {
  setupState: string;
  oauthAuthorized: boolean;
  status: string;
}

const CLIENT_ID = 'onedoor-app';
const CLIENT_SECRET = 'app-secret';

describe('upstream OAuth with client details (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;
  let twin: OAuthFlowTwin;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;

  async function graphql(query: string, variables: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    return res.body as {
      data?: Record<string, unknown> | null;
      errors?: { extensions: { code: string } }[];
    };
  }

  async function createManualConnection(
    displayName: string,
    oauthClientSecret: string,
  ) {
    const body = await graphql(
      'mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }',
      {
        input: {
          displayName,
          url: twin.url,
          authType: 'OAUTH_MANUAL',
          oauthClientId: CLIENT_ID,
          oauthClientSecret,
        },
      },
    );
    expect(body.errors).toBeUndefined();
    const id = (body.data?.createConnection as { id?: string } | undefined)?.id;
    if (!id) throw new Error('No connection was created');
    return id;
  }

  async function stateOf(id: string): Promise<ConnectionState> {
    const body = await graphql(
      'query ($id: ID!) { connection(id: $id) { setupState oauthAuthorized status } }',
      { id },
    );
    return body.data?.connection as ConnectionState;
  }

  // Starts an authorization, follows the twin's redirect as the browser
  // would, and delivers the callback. Returns where OneDoor sends the
  // browser.
  async function authorize(id: string): Promise<string> {
    const body = await graphql(
      'mutation ($id: ID!) { startOAuthAuthorization(id: $id) }',
      { id },
    );
    expect(body.errors).toBeUndefined();
    const res = await fetch(body.data?.startOAuthAuthorization as string, {
      redirect: 'manual',
    });
    const callback = new URL(res.headers.get('location') ?? '');
    const back = await request(app.getHttpServer())
      .get(`/oauth/callback${callback.search}`)
      .expect(302);
    return back.headers.location as string;
  }

  beforeAll(async () => {
    [postgres, redis, twin] = await Promise.all([
      startMigratedPostgres(),
      new RedisContainer(REDIS_IMAGE).start(),
      startOAuthFlowTwin({
        client: {
          id: CLIENT_ID,
          secret: CLIENT_SECRET,
          redirectUris: [CALLBACK],
        },
      }),
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
    vi.stubEnv('OAUTH_REDIRECT_URL', CALLBACK);
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
    await Promise.allSettled([twin?.close(), redis?.stop(), postgres?.stop()]);
    vi.unstubAllEnvs();
  });

  it('tells the owner which redirect URI to register in the OAuth app (T22)', async () => {
    const body = await graphql('{ oauthRedirectUrl }', {});
    expect(body.data).toEqual({ oauthRedirectUrl: CALLBACK });
  });

  it('authorizes with the OAuth app, connects, syncs and refreshes with the client secret (T22)', async () => {
    const id = await createManualConnection('Manual twin', CLIENT_SECRET);
    expect(await stateOf(id)).toEqual({
      setupState: 'NEEDS_CREDENTIALS',
      oauthAuthorized: false,
      status: 'OFF',
    });

    expect(await authorize(id)).toBe(
      `http://localhost:3001/servers/${id}?oauth=authorized`,
    );
    await registry.sync(id);
    expect(await stateOf(id)).toEqual({
      setupState: 'READY',
      oauthAuthorized: true,
      status: 'CONNECTED',
    });
    // The owner's app is used; OneDoor registers nothing.
    expect(twin.registrations).toBe(0);
    const row = await prisma.connectionOAuth.findUniqueOrThrow({
      where: { connectionId: id },
    });
    expect(row.clientCiphertext).toBeNull();

    await vi.waitFor(
      async () =>
        expect(await prisma.tool.count({ where: { connectionId: id } })).toBe(
          2,
        ),
      { timeout: 10_000, interval: 50 },
    );
    const refreshes = twin.refreshes;
    twin.expireAccessTokens();
    const tools = await registry.listTools(id);
    expect(tools?.map((tool) => tool.name)).toEqual(['alpha', 'beta']);
    expect(twin.refreshes).toBe(refreshes + 1);
  });

  it('fails the callback when the client secret is wrong (T22)', async () => {
    const id = await createManualConnection('Wrong secret', 'not-the-secret');
    expect(await authorize(id)).toBe(
      `http://localhost:3001/servers/${id}?oauth=failed`,
    );
    expect((await stateOf(id)).oauthAuthorized).toBe(false);
  });

  it('opens a new client when the OAuth app changes (T22)', async () => {
    const id = await createManualConnection('Changing app', CLIENT_SECRET);
    await authorize(id);
    await registry.sync(id);
    const before = registry.client(id);
    expect(before).toBeDefined();

    await graphql(
      'mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }',
      { id, input: { oauthClientSecret: CLIENT_SECRET } },
    );
    await registry.sync(id);
    expect(registry.status(id)).toBe('CONNECTED');
    expect(registry.client(id)).not.toBe(before);
  });
});
