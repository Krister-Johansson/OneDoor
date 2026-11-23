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
const CLIENT_ID = 'catalog-app';
const CLIENT_SECRET = 'catalog-app-secret';

const SET_APP = `mutation ($id: ID!, $input: SetCatalogOAuthClientInput!) {
  setCatalogOAuthClient(catalogEntryId: $id, input: $input) {
    id
    authOptions { authType oauthClientId hasClientSecret }
  }
}`;

interface GraphqlBody {
  data?: Record<string, unknown> | null;
  errors?: { extensions: { code: string } }[];
}

// T22: a catalog entry's OAUTH_MANUAL option holds the OAuth app that every
// connection on it uses.
describe('catalog OAuth app (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;
  let twin: OAuthFlowTwin;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;
  let entryId: string;
  let optionId: string;

  async function graphql(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphqlBody> {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    return res.body as GraphqlBody;
  }

  async function switchOn(authType: string): Promise<GraphqlBody> {
    return graphql(
      'mutation ($id: ID!, $authType: AuthType!) { switchOnCatalogEntry(catalogEntryId: $id, authType: $authType) { id setupState oauthClientId hasClientSecret } }',
      { id: entryId, authType },
    );
  }

  async function stateOf(id: string) {
    const body = await graphql(
      'query ($id: ID!) { connection(id: $id) { setupState oauthAuthorized status } }',
      { id },
    );
    return body.data?.connection;
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
    // A catalog entry on the twin, as the seed would create it.
    const entry = await prisma.catalogEntry.create({
      data: {
        key: 'twin',
        displayName: 'Twin',
        authOptions: { create: { authType: 'OAUTH_MANUAL', url: twin.url } },
      },
      include: { authOptions: true },
    });
    entryId = entry.id;
    optionId = entry.authOptions[0]?.id ?? '';

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

  it('lists GitHub with an OAUTH_MANUAL option that has no OAuth app yet (T22)', async () => {
    const body = await graphql(
      '{ catalog { key authOptions { authType oauthClientId hasClientSecret } } }',
      {},
    );
    const catalog = (body.data?.catalog ?? []) as {
      key: string;
      authOptions: unknown[];
    }[];
    const github = catalog.find((entry) => entry.key === 'github');
    expect(github?.authOptions).toEqual([
      { authType: 'API_KEY', oauthClientId: null, hasClientSecret: false },
      { authType: 'OAUTH_MANUAL', oauthClientId: null, hasClientSecret: false },
    ]);
  });

  it('refuses to switch on OAUTH_MANUAL before the OAuth app is set (T22)', async () => {
    const body = await switchOn('OAUTH_MANUAL');
    expect(body.errors?.[0]?.extensions.code).toBe('VALIDATION');
    expect(
      await prisma.connection.count({ where: { catalogEntryId: entryId } }),
    ).toBe(0);
  });

  it('stores the client secret encrypted and never returns it (T22)', async () => {
    const body = await graphql(SET_APP, {
      id: entryId,
      input: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
    });
    expect(body.errors).toBeUndefined();
    expect(body.data?.setCatalogOAuthClient).toEqual({
      id: entryId,
      authOptions: [
        {
          authType: 'OAUTH_MANUAL',
          oauthClientId: CLIENT_ID,
          hasClientSecret: true,
        },
      ],
    });
    expect(JSON.stringify(body)).not.toContain(CLIENT_SECRET);
    const option = await prisma.catalogAuthOption.findUniqueOrThrow({
      where: { id: optionId },
    });
    expect(option.oauthClientSecretCiphertext).toBeTruthy();
    expect(option.oauthClientSecretCiphertext).not.toContain(CLIENT_SECRET);
  });

  it("authorizes a catalog connection with its option's OAuth app and connects (T22)", async () => {
    const body = await switchOn('OAUTH_MANUAL');
    expect(body.errors).toBeUndefined();
    const connection = body.data?.switchOnCatalogEntry as {
      id: string;
      setupState: string;
      oauthClientId: string | null;
      hasClientSecret: boolean;
    };
    expect(connection).toMatchObject({
      setupState: 'NEEDS_CREDENTIALS',
      oauthClientId: CLIENT_ID,
      hasClientSecret: true,
    });

    expect(await authorize(connection.id)).toBe(
      `http://localhost:3001/servers/${connection.id}?oauth=authorized`,
    );
    await registry.sync(connection.id);
    expect(await stateOf(connection.id)).toEqual({
      setupState: 'READY',
      oauthAuthorized: true,
      status: 'CONNECTED',
    });
    // The option's app is used; OneDoor registers nothing.
    expect(twin.registrations).toBe(0);
  });

  it("opens a new client for every connection when the option's OAuth app changes (T22)", async () => {
    const connection = await prisma.connection.findFirstOrThrow({
      where: { catalogEntryId: entryId },
    });
    await registry.sync(connection.id);
    const before = registry.client(connection.id);
    expect(before).toBeDefined();

    // The same values, encrypted again: the stored ciphertext changes.
    const body = await graphql(SET_APP, {
      id: entryId,
      input: { clientId: CLIENT_ID, clientSecret: CLIENT_SECRET },
    });
    expect(body.errors).toBeUndefined();
    await registry.sync(connection.id);
    expect(registry.status(connection.id)).toBe('CONNECTED');
    expect(registry.client(connection.id)).not.toBe(before);
  });

  it('keeps the secret when it is left out and deletes it with null (T22)', async () => {
    const kept = await graphql(SET_APP, {
      id: entryId,
      input: { clientId: CLIENT_ID },
    });
    expect(kept.data?.setCatalogOAuthClient).toMatchObject({
      authOptions: [{ hasClientSecret: true }],
    });
    const deleted = await graphql(SET_APP, {
      id: entryId,
      input: { clientId: CLIENT_ID, clientSecret: null },
    });
    expect(deleted.data?.setCatalogOAuthClient).toMatchObject({
      authOptions: [{ hasClientSecret: false }],
    });
  });

  it('answers VALIDATION for an entry without OAUTH_MANUAL and NOT_FOUND for an unknown one (T22)', async () => {
    const context7 = await prisma.catalogEntry.findUniqueOrThrow({
      where: { key: 'context7' },
    });
    const input = { clientId: CLIENT_ID };
    const wrong = await graphql(SET_APP, { id: context7.id, input });
    expect(wrong.errors?.[0]?.extensions.code).toBe('VALIDATION');
    const unknown = await graphql(SET_APP, {
      id: '00000000-0000-7000-8000-000000000000',
      input,
    });
    expect(unknown.errors?.[0]?.extensions.code).toBe('NOT_FOUND');
  });
});
