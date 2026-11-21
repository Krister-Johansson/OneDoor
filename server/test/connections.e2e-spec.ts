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

const CONNECTION_FIELDS = `
  id catalogEntryId displayName description url authType headerName headerPrefix enabled
`;

describe('connections query (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  const ids: Record<string, string> = {};

  function graphql(query: string, variables?: Record<string, unknown>) {
    return request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
  }

  beforeAll(async () => {
    postgres = await startMigratedPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    const me = await prisma.user.findUniqueOrThrow({ where: { name: 'me' } });
    const other = await prisma.user.create({ data: { name: 'other' } });
    const entry = await prisma.catalogEntry.create({
      data: {
        key: 'acme',
        displayName: 'Acme Catalog',
        description: 'From the catalog',
        url: 'https://mcp.acme.test/mcp',
        authType: 'API_KEY',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    });
    ids.custom = (
      await prisma.connection.create({
        data: {
          ownerId: me.id,
          displayName: 'beta tools',
          url: 'https://beta.test/mcp',
          authType: 'NONE',
        },
      })
    ).id;
    ids.catalog = (
      await prisma.connection.create({
        data: { ownerId: me.id, catalogEntryId: entry.id, enabled: false },
      })
    ).id;
    ids.foreign = (
      await prisma.connection.create({
        data: {
          ownerId: other.id,
          displayName: 'Other user',
          url: 'https://other.test/mcp',
          authType: 'NONE',
        },
      })
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

  it("lists only the caller's connections, sorted by display name (REQ-CONN-001)", async () => {
    const res = await graphql(`{ connections { ${CONNECTION_FIELDS} } }`);
    expect(res.body.errors).toBeUndefined();
    expect(res.body.data.connections).toEqual([
      {
        id: ids.catalog,
        catalogEntryId: expect.any(String),
        displayName: 'Acme Catalog',
        description: 'From the catalog',
        url: 'https://mcp.acme.test/mcp',
        authType: 'API_KEY',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
        enabled: false,
      },
      {
        id: ids.custom,
        catalogEntryId: null,
        displayName: 'beta tools',
        description: '',
        url: 'https://beta.test/mcp',
        authType: 'NONE',
        headerName: null,
        headerPrefix: null,
        enabled: true,
      },
    ]);
  });

  it("returns one of the caller's connections by id", async () => {
    const res = await graphql(
      'query ($id: ID!) { connection(id: $id) { id displayName } }',
      { id: ids.custom },
    );
    expect(res.body.data.connection).toEqual({
      id: ids.custom,
      displayName: 'beta tools',
    });
  });

  it.each([
    ['another user', () => ids.foreign],
    ['an unknown id', () => '0190c3c8-0000-7000-8000-000000000000'],
    ['an id that is not a UUID', () => 'not-a-uuid'],
  ])('answers NOT_FOUND for %s', async (_name, id) => {
    const res = await graphql(
      'query ($id: ID!) { connection(id: $id) { id } }',
      { id: id() },
    );
    expect(res.body.data).toBeNull();
    expect(res.body.errors).toHaveLength(1);
    expect(res.body.errors[0]).toMatchObject({
      message: 'Connection not found',
      extensions: { code: 'NOT_FOUND' },
    });
  });
});
