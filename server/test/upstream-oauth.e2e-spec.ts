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

describe('upstream OAuth with dynamic client registration (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;
  let twin: OAuthFlowTwin;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;
  let otherId: string;

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

  async function createOAuthConnection(displayName: string) {
    const body = await graphql(
      'mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }',
      { input: { displayName, url: twin.url, authType: 'OAUTH_DCR' } },
    );
    expect(body.errors).toBeUndefined();
    return createdId(body.data);
  }

  async function stateOf(id: string): Promise<ConnectionState> {
    const body = await graphql(
      'query ($id: ID!) { connection(id: $id) { setupState oauthAuthorized status } }',
      { id },
    );
    return body.data?.connection as ConnectionState;
  }

  // Starts an authorization and follows the twin's redirect, as the browser
  // would. Returns the callback URL the twin sent the browser to.
  async function authorizeAtTwin(id: string): Promise<URL> {
    const body = await graphql(
      'mutation ($id: ID!) { startOAuthAuthorization(id: $id) }',
      { id },
    );
    expect(body.errors).toBeUndefined();
    const authorizationUrl = new URL(
      body.data?.startOAuthAuthorization as string,
    );
    expect(authorizationUrl.origin).toBe(twin.origin);
    const res = await fetch(authorizationUrl, { redirect: 'manual' });
    expect(res.status).toBe(302);
    const callback = new URL(res.headers.get('location') ?? '');
    expect(`${callback.origin}${callback.pathname}`).toBe(CALLBACK);
    return callback;
  }

  // Delivers the callback to OneDoor and returns where it sends the browser.
  async function deliver(callback: URL): Promise<string> {
    const res = await request(app.getHttpServer())
      .get(`/oauth/callback${callback.search}`)
      .expect(302);
    expect(res.headers['cache-control']).toBe('no-store');
    return res.headers.location as string;
  }

  async function authorize(id: string) {
    const landing = await deliver(await authorizeAtTwin(id));
    expect(landing).toBe(
      `http://localhost:3001/servers/${id}?oauth=authorized`,
    );
    await registry.sync(id);
  }

  beforeAll(async () => {
    [postgres, redis, twin] = await Promise.all([
      startMigratedPostgres(),
      new RedisContainer(REDIS_IMAGE).start(),
      startOAuthFlowTwin(),
    ]);
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    otherId = (await prisma.user.create({ data: { name: 'other' } })).id;

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

  it('registers, authorizes, stores the tokens encrypted, connects and syncs the tools (T21)', async () => {
    const id = await createOAuthConnection('OAuth twin');
    expect(await stateOf(id)).toEqual({
      setupState: 'NEEDS_CREDENTIALS',
      oauthAuthorized: false,
      status: 'OFF',
    });

    await authorize(id);
    expect(twin.registrations).toBe(1);
    expect(await stateOf(id)).toEqual({
      setupState: 'READY',
      oauthAuthorized: true,
      status: 'CONNECTED',
    });
    await vi.waitFor(
      async () =>
        expect(
          (await prisma.tool.findMany({ where: { connectionId: id } })).map(
            (tool) => tool.name,
          ),
        ).toEqual(expect.arrayContaining(['alpha', 'beta'])),
      { timeout: 10_000, interval: 50 },
    );

    // REQ-CONN-041: only ciphertext is stored.
    const row = await prisma.connectionOAuth.findUniqueOrThrow({
      where: { connectionId: id },
    });
    expect(row.tokensCiphertext).not.toBeNull();
    expect(JSON.stringify(row)).not.toMatch(/access-\d|refresh-\d|client-\d/);
    expect(row.authorizedAt).not.toBeNull();
  });

  it('refreshes an expired access token without the owner (T21)', async () => {
    const id = await createOAuthConnection('Refreshing');
    await authorize(id);
    // The first tool sync runs right after connect; wait for it, so this
    // test's request is the only one that meets the expired token.
    await vi.waitFor(
      async () =>
        expect(await prisma.tool.count({ where: { connectionId: id } })).toBe(
          2,
        ),
      { timeout: 10_000, interval: 50 },
    );
    const { authorizedAt } = await prisma.connectionOAuth.findUniqueOrThrow({
      where: { connectionId: id },
    });
    const refreshes = twin.refreshes;

    twin.expireAccessTokens();
    const tools = await registry.listTools(id);
    expect(tools?.map((tool) => tool.name)).toEqual(['alpha', 'beta']);
    expect(twin.refreshes).toBe(refreshes + 1);
    expect(registry.status(id)).toBe('CONNECTED');
    // A refresh is not a new authorization.
    const after = await prisma.connectionOAuth.findUniqueOrThrow({
      where: { connectionId: id },
    });
    expect(after.authorizedAt).toEqual(authorizedAt);
  });

  it('keeps the authorization when several requests meet an expired token at once (T21)', async () => {
    const id = await createOAuthConnection('Concurrent');
    await authorize(id);

    twin.expireAccessTokens();
    const results = await Promise.all([
      registry.listTools(id),
      registry.listTools(id),
      registry.listTools(id),
    ]);
    for (const tools of results) {
      expect(tools?.map((tool) => tool.name)).toEqual(['alpha', 'beta']);
    }
    expect(registry.status(id)).toBe('CONNECTED');
    expect((await stateOf(id)).oauthAuthorized).toBe(true);
  });

  it('deletes the tokens and asks the owner again when the refresh is refused (T21)', async () => {
    const id = await createOAuthConnection('Revoked');
    await authorize(id);

    twin.revokeAll();
    await expect(registry.listTools(id)).rejects.toThrow();
    await vi.waitFor(
      async () =>
        expect(await stateOf(id)).toEqual({
          setupState: 'NEEDS_CREDENTIALS',
          oauthAuthorized: false,
          status: 'OFF',
        }),
      { timeout: 10_000, interval: 50 },
    );
    const row = await prisma.connectionOAuth.findUniqueOrThrow({
      where: { connectionId: id },
    });
    expect(row.tokensCiphertext).toBeNull();
    // The registration is kept, so authorizing again registers no new client.
    expect(row.clientCiphertext).not.toBeNull();
    const registrations = twin.registrations;
    await authorize(id);
    expect(twin.registrations).toBe(registrations);
    expect(registry.status(id)).toBe('CONNECTED');
  });

  it('accepts a state once, and reports a denial (T21)', async () => {
    const id = await createOAuthConnection('Once');
    const callback = await authorizeAtTwin(id);
    expect(await deliver(callback)).toContain('oauth=authorized');
    expect(await deliver(callback)).toBe(
      'http://localhost:3001/servers?oauth=expired',
    );

    const denied = await createOAuthConnection('Denied');
    twin.denyNext();
    expect(await deliver(await authorizeAtTwin(denied))).toBe(
      `http://localhost:3001/servers/${denied}?oauth=denied`,
    );
    expect((await stateOf(denied)).oauthAuthorized).toBe(false);

    expect(
      await deliver(new URL(`${CALLBACK}?code=made-up&state=made-up`)),
    ).toBe('http://localhost:3001/servers?oauth=expired');
  });

  it("refuses another owner's connection and other auth types (T21)", async () => {
    const theirs = await prisma.connection.create({
      data: {
        ownerId: otherId,
        displayName: 'Theirs',
        url: twin.url,
        authType: 'OAUTH_DCR',
      },
    });
    const notFound = await graphql(
      'mutation ($id: ID!) { startOAuthAuthorization(id: $id) }',
      { id: theirs.id },
    );
    expect(notFound.errors?.[0]?.extensions.code).toBe('NOT_FOUND');

    const created = await graphql(
      'mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id } }',
      {
        input: {
          displayName: 'Open',
          url: twin.url,
          authType: 'NONE',
        },
      },
    );
    const openId = createdId(created.data);
    const wrongType = await graphql(
      'mutation ($id: ID!) { startOAuthAuthorization(id: $id) }',
      { id: openId },
    );
    expect(wrongType.errors?.[0]?.extensions.code).toBe('VALIDATION');
  });

  it('deletes the OAuth state when the URL changes (REQ-CONN-023)', async () => {
    const id = await createOAuthConnection('Moved');
    await authorize(id);
    await graphql(
      'mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }',
      { id, input: { url: `${twin.origin}/mcp/other` } },
    );
    expect(
      await prisma.connectionOAuth.findUnique({ where: { connectionId: id } }),
    ).toBeNull();
    expect((await stateOf(id)).setupState).toBe('NEEDS_CREDENTIALS');
  });
});

function createdId(data: Record<string, unknown> | null | undefined): string {
  const id = (data?.createConnection as { id?: string } | undefined)?.id;
  if (!id) throw new Error('No connection was created');
  return id;
}
