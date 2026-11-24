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
// A public client, as an Entra app for Azure DevOps usually is: no secret.
const CLIENT_ID = 'public-app';

const SWITCH_ON = `mutation ($id: ID!, $urlParameters: [UrlParameterInput!]) {
  switchOnCatalogEntry(catalogEntryId: $id, authType: OAUTH_MANUAL, urlParameters: $urlParameters) {
    id url setupState oauthAuthorized
  }
}`;

interface GraphqlBody {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions: { code: string } }[];
}

interface SwitchedOn {
  id: string;
  url: string;
  setupState: string;
  oauthAuthorized: boolean;
}

// T22: a catalog option's URL may hold placeholders, such as the
// organization of Azure DevOps, which each connection fills in.
describe('catalog URL parameters (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let prisma: PrismaClient;
  let twin: OAuthFlowTwin;
  let app: INestApplication<App>;
  let registry: UpstreamRegistryService;
  let entryId: string;

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

  async function switchOn(urlParameters?: { name: string; value: string }[]) {
    return graphql(SWITCH_ON, { id: entryId, urlParameters });
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
        client: { id: CLIENT_ID, redirectUris: [CALLBACK] },
      }),
    ]);
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    // Like the seeded Azure DevOps entry, on the twin: `{organization}`
    // set to `mcp` gives the twin's MCP URL.
    const entry = await prisma.catalogEntry.create({
      data: {
        key: 'templated-twin',
        displayName: 'Templated Twin',
        authOptions: {
          create: {
            authType: 'OAUTH_MANUAL',
            url: `${new URL(twin.url).origin}/{organization}`,
            oauthClientId: CLIENT_ID,
          },
        },
      },
    });
    entryId = entry.id;

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

  it('lists Azure DevOps with its organization placeholder (T22)', async () => {
    const body = await graphql(
      '{ catalog { key authOptions { authType url urlParameters } } }',
      {},
    );
    const catalog = (body.data?.catalog ?? []) as {
      key: string;
      authOptions: unknown[];
    }[];
    expect(catalog.find((e) => e.key === 'azure-devops')?.authOptions).toEqual([
      {
        authType: 'OAUTH_MANUAL',
        url: 'https://mcp.dev.azure.com/{organization}',
        urlParameters: ['organization'],
      },
    ]);
  });

  it.each([
    ['no value', undefined],
    [
      'a value that is not a path segment',
      [{ name: 'organization', value: 'a/b' }],
    ],
    [
      'a value that changes the host',
      [{ name: 'organization', value: 'x@evil.test' }],
    ],
    [
      'an unknown name',
      [
        { name: 'organization', value: 'mcp' },
        { name: 'project', value: 'p' },
      ],
    ],
    [
      'a name twice',
      [
        { name: 'organization', value: 'mcp' },
        { name: 'organization', value: 'mcp' },
      ],
    ],
  ])('answers VALIDATION for %s (T22)', async (_, urlParameters) => {
    const body = await switchOn(urlParameters);
    expect(body.errors?.[0]?.extensions.code).toBe('VALIDATION');
    expect(
      await prisma.connection.count({ where: { catalogEntryId: entryId } }),
    ).toBe(0);
  });

  it('builds the URL from the organization, authorizes with a public client and connects (T22)', async () => {
    const body = await switchOn([{ name: 'organization', value: 'mcp' }]);
    expect(body.errors).toBeUndefined();
    const connection = body.data?.switchOnCatalogEntry as SwitchedOn;
    expect(connection).toMatchObject({
      url: twin.url,
      setupState: 'NEEDS_CREDENTIALS',
    });

    expect(await authorize(connection.id)).toBe(
      `http://localhost:3001/servers/${connection.id}?oauth=authorized`,
    );
    await registry.sync(connection.id);
    expect(registry.status(connection.id)).toBe('CONNECTED');
    expect(twin.registrations).toBe(0);
  });

  it('keeps the organization when it is left out, and starts from no credentials when it changes (T22)', async () => {
    const kept = await switchOn();
    expect(kept.errors).toBeUndefined();
    expect(kept.data?.switchOnCatalogEntry).toMatchObject({
      url: twin.url,
      oauthAuthorized: true,
    });

    const moved = await switchOn([{ name: 'organization', value: 'other' }]);
    expect(moved.errors).toBeUndefined();
    const connection = moved.data?.switchOnCatalogEntry as SwitchedOn;
    expect(connection).toMatchObject({
      url: `${new URL(twin.url).origin}/other`,
      setupState: 'NEEDS_CREDENTIALS',
      oauthAuthorized: false,
    });
    await registry.sync(connection.id);
    expect(registry.status(connection.id)).toBe('OFF');
  });
});
