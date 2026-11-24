import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { seed } from '../prisma/seed.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { startMigratedPostgres } from './support/database.js';
import { stubAppEnv } from './support/env.js';

const API_KEY = 'ctx7sk-test-key-that-must-never-be-returned';
const CONNECTION_FIELDS =
  'id catalogEntryId displayName url authType headerName headerPrefix hasApiKey setupState enabled';

interface GraphqlBody {
  data?: Record<string, unknown> | null;
  errors?: { message: string; extensions: { code: string } }[];
}

describe('catalog (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let context7Id: string;
  let githubId: string;

  async function graphql(
    query: string,
    variables?: Record<string, unknown>,
  ): Promise<GraphqlBody> {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    expect(res.text).not.toContain(API_KEY);
    return res.body as GraphqlBody;
  }

  function switchOn(catalogEntryId: string, authType: string) {
    return graphql(
      `mutation ($id: ID!, $authType: AuthType!) {
        switchOnCatalogEntry(catalogEntryId: $id, authType: $authType) { ${CONNECTION_FIELDS} }
      }`,
      { id: catalogEntryId, authType },
    );
  }

  function setApiKey(id: string, apiKey: string | null) {
    return graphql(
      `mutation ($id: ID!, $input: UpdateConnectionInput!) {
        updateConnection(id: $id, input: $input) { ${CONNECTION_FIELDS} }
      }`,
      { id, input: { apiKey } },
    );
  }

  function setEnabled(id: string, enabled: boolean) {
    return graphql(
      'mutation ($id: ID!, $enabled: Boolean!) { setConnectionEnabled(id: $id, enabled: $enabled) { id } }',
      { id, enabled },
    );
  }

  const codeOf = (body: GraphqlBody) => body.errors?.[0]?.extensions.code;

  beforeAll(async () => {
    postgres = await startMigratedPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    context7Id = (
      await prisma.catalogEntry.findUniqueOrThrow({
        where: { key: 'context7' },
      })
    ).id;
    githubId = (
      await prisma.catalogEntry.findUniqueOrThrow({ where: { key: 'github' } })
    ).id;

    stubAppEnv({ DATABASE_URL: postgres.getConnectionUri() });
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await postgres?.stop();
    vi.unstubAllEnvs();
  });

  it('lists the seeded entries with their auth options and no connection (REQ-CONN-011)', async () => {
    const body = await graphql(
      '{ catalog { key displayName authOptions { authType url headerName headerPrefix } connection { id } } }',
    );
    expect(body.data?.catalog).toEqual([
      {
        key: 'azure-devops',
        displayName: 'Azure DevOps',
        authOptions: [
          {
            authType: 'OAUTH_MANUAL',
            url: 'https://mcp.dev.azure.com/{organization}',
            headerName: null,
            headerPrefix: null,
          },
        ],
        connection: null,
      },
      {
        key: 'context7',
        displayName: 'Context7',
        authOptions: [
          {
            authType: 'API_KEY',
            url: 'https://mcp.context7.com/mcp',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
          },
          {
            authType: 'OAUTH_DCR',
            url: 'https://mcp.context7.com/mcp/oauth',
            headerName: null,
            headerPrefix: null,
          },
        ],
        connection: null,
      },
      {
        key: 'github',
        displayName: 'GitHub',
        authOptions: [
          {
            authType: 'API_KEY',
            url: 'https://api.githubcopilot.com/mcp/',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
          },
          {
            authType: 'OAUTH_MANUAL',
            url: 'https://api.githubcopilot.com/mcp/',
            headerName: null,
            headerPrefix: null,
          },
        ],
        connection: null,
      },
    ]);
  });

  it('switches on an entry, takes a key, keeps it across off and on, and drops it for another option (REQ-CONN-012, REQ-CONN-013)', async () => {
    const first = await switchOn(context7Id, 'API_KEY');
    expect(first.errors).toBeUndefined();
    const connection = first.data?.switchOnCatalogEntry as Record<
      string,
      unknown
    >;
    expect(connection).toMatchObject({
      catalogEntryId: context7Id,
      displayName: 'Context7',
      url: 'https://mcp.context7.com/mcp',
      authType: 'API_KEY',
      headerName: 'Authorization',
      hasApiKey: false,
      setupState: 'NEEDS_CREDENTIALS',
      enabled: true,
    });
    const id = connection.id as string;

    expect((await setApiKey(id, API_KEY)).data?.updateConnection).toMatchObject(
      {
        hasApiKey: true,
        setupState: 'READY',
      },
    );

    await setEnabled(id, false);
    const again = await switchOn(context7Id, 'API_KEY');
    expect(again.data?.switchOnCatalogEntry).toMatchObject({
      id,
      enabled: true,
      hasApiKey: true,
    });

    const moved = await switchOn(context7Id, 'OAUTH_DCR');
    expect(moved.data?.switchOnCatalogEntry).toMatchObject({
      id,
      url: 'https://mcp.context7.com/mcp/oauth',
      authType: 'OAUTH_DCR',
      headerName: null,
      hasApiKey: false,
      setupState: 'NEEDS_CREDENTIALS',
    });
    expect(
      await prisma.connection.count({ where: { catalogEntryId: context7Id } }),
    ).toBe(1);

    const catalog = await graphql(
      '{ catalog { key connection { id authType } } }',
    );
    expect(catalog.data?.catalog).toContainEqual({
      key: 'context7',
      connection: { id, authType: 'OAUTH_DCR' },
    });
  });

  it('answers VALIDATION for an auth type the entry does not offer', async () => {
    expect(codeOf(await switchOn(githubId, 'OAUTH_DCR'))).toBe('VALIDATION');
  });

  it('answers NOT_FOUND for an unknown entry', async () => {
    expect(
      codeOf(await switchOn('0190c3c8-0000-7000-8000-000000000000', 'API_KEY')),
    ).toBe('NOT_FOUND');
    expect(codeOf(await switchOn('github', 'API_KEY'))).toBe('NOT_FOUND');
  });

  it('answers CONFLICT when a custom connection has the entry name (REQ-CONN-012)', async () => {
    await graphql(
      `mutation { createConnection(input: { displayName: "github", url: "https://own.test/mcp", authType: NONE }) { id } }`,
    );
    expect(codeOf(await switchOn(githubId, 'API_KEY'))).toBe('CONFLICT');
  });

  it('refuses a URL change on a catalog-based connection (REQ-CONN-013)', async () => {
    const connection = await prisma.connection.findFirstOrThrow({
      where: { catalogEntryId: context7Id },
    });
    const body = await graphql(
      'mutation ($id: ID!) { updateConnection(id: $id, input: { url: "https://evil.test/mcp" }) { id } }',
      { id: connection.id },
    );
    expect(codeOf(body)).toBe('VALIDATION');
  });
});
