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

const TOOL_FIELDS = `
  id connectionId name title description enabled
  annotations { readOnlyHint destructiveHint idempotentHint openWorldHint }
`;

describe('tool policy (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let mineId: string;
  let echoId: string;
  let theirToolId: string;

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

  function toolsOf(connectionId: string) {
    return graphql(
      `query ($id: ID!) { connection(id: $id) { tools { ${TOOL_FIELDS} } } }`,
      { id: connectionId },
    );
  }

  function setToolEnabled(id: string, enabled: boolean) {
    return graphql(
      `mutation ($id: ID!, $enabled: Boolean!) { setToolEnabled(id: $id, enabled: $enabled) { ${TOOL_FIELDS} } }`,
      { id, enabled },
    );
  }

  beforeAll(async () => {
    postgres = await startMigratedPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    const me = await prisma.user.findUniqueOrThrow({ where: { name: 'me' } });
    const other = await prisma.user.create({ data: { name: 'other' } });

    const mine = await prisma.connection.create({
      data: {
        ownerId: me.id,
        displayName: 'Mine',
        url: 'https://mine.test/mcp',
        authType: 'NONE',
      },
    });
    mineId = mine.id;
    // Stored as a sync stores them: reverse first, so the order comes from
    // the query.
    await prisma.tool.create({
      data: {
        ownerId: me.id,
        connectionId: mine.id,
        name: 'reverse',
        inputSchema: { type: 'object' },
        contentHash: 'r',
      },
    });
    echoId = (
      await prisma.tool.create({
        data: {
          ownerId: me.id,
          connectionId: mine.id,
          name: 'echo',
          title: 'Echo',
          description: 'Echoes the text.',
          inputSchema: { type: 'object' },
          // Untrusted: only boolean hints reach the caller.
          annotations: {
            readOnlyHint: true,
            destructiveHint: 'no',
            title: 'Echo tool',
          },
          contentHash: 'e',
        },
      })
    ).id;

    const theirs = await prisma.connection.create({
      data: {
        ownerId: other.id,
        displayName: 'Theirs',
        url: 'https://theirs.test/mcp',
        authType: 'NONE',
      },
    });
    theirToolId = (
      await prisma.tool.create({
        data: {
          ownerId: other.id,
          connectionId: theirs.id,
          name: 'echo',
          inputSchema: { type: 'object' },
          contentHash: 'e',
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

  it("lists a connection's tools by name, enabled, with only the boolean annotation hints (T19)", async () => {
    const body = await toolsOf(mineId);
    expect(body.errors).toBeUndefined();
    expect(body.data?.connection?.tools).toEqual([
      {
        id: echoId,
        connectionId: mineId,
        name: 'echo',
        title: 'Echo',
        description: 'Echoes the text.',
        enabled: true,
        annotations: {
          readOnlyHint: true,
          destructiveHint: null,
          idempotentHint: null,
          openWorldHint: null,
        },
      },
      expect.objectContaining({ name: 'reverse', enabled: true, title: null }),
    ]);
  });

  it('disables and enables a tool (T19)', async () => {
    const off = await setToolEnabled(echoId, false);
    expect(off.errors).toBeUndefined();
    expect(off.data?.setToolEnabled).toMatchObject({
      id: echoId,
      enabled: false,
    });
    const listed = await toolsOf(mineId);
    expect(listed.data?.connection?.tools).toEqual([
      expect.objectContaining({ name: 'echo', enabled: false }),
      expect.objectContaining({ name: 'reverse', enabled: true }),
    ]);

    const on = await setToolEnabled(echoId, true);
    expect(on.data?.setToolEnabled).toMatchObject({ enabled: true });
  });

  it("refuses to change another owner's tool or an unknown id (T19)", async () => {
    for (const id of [theirToolId, 'not-a-uuid', crypto.randomUUID()]) {
      const body = await setToolEnabled(id, false);
      expect(body.errors?.[0]?.extensions.code).toBe('NOT_FOUND');
    }
    const theirs = await prisma.tool.findUniqueOrThrow({
      where: { id: theirToolId },
    });
    expect(theirs.enabled).toBe(true);
  });
});
