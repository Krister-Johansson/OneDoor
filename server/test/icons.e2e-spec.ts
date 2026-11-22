import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { IconRefreshService } from '../src/upstreams/icon-refresh/icon-refresh.service.js';
import { startMigratedPostgres } from './support/database.js';
import { stubAppEnv } from './support/env.js';
import {
  startIconTwin,
  TWIN_ICO,
  TWIN_PNG,
  type Twin,
} from './twins/mcp-twins.js';

interface GraphqlBody {
  data?: Record<string, Record<string, unknown>> | null;
  errors?: { message: string; extensions: { code: string } }[];
}

describe('server icons (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let refresh: IconRefreshService;
  const twins: Record<string, Twin> = {};

  async function graphql(query: string, variables?: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    return res.body as GraphqlBody;
  }

  async function createConnection(displayName: string, url: string) {
    const body = await graphql(
      'mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { id iconUrl } }',
      { input: { displayName, url, authType: 'NONE' } },
    );
    return body.data?.createConnection as { id: string; iconUrl: string };
  }

  async function iconUrlOf(id: string): Promise<string> {
    const body = await graphql(
      'query ($id: ID!) { connection(id: $id) { iconUrl } }',
      { id },
    );
    return body.data?.connection?.iconUrl as string;
  }

  // The refresh runs in the background, so wait for it.
  async function waitForStoredIcon(id: string): Promise<string> {
    for (let attempt = 0; attempt < 50; attempt++) {
      const url = await iconUrlOf(id);
      if (!url.startsWith('/icons/letter/')) return url;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error(`Connection ${id} got no stored icon`);
  }

  beforeAll(async () => {
    [twins.png, twins.htmlThenFavicon, twins.oversized, twins.catalog] =
      await Promise.all([
        startIconTwin({ mcpIcon: 'png', favicon: 'none' }),
        startIconTwin({ mcpIcon: 'html', favicon: 'ico' }),
        startIconTwin({ mcpIcon: 'oversized', favicon: 'none' }),
        startIconTwin({ mcpIcon: 'png', favicon: 'none' }),
      ]);

    postgres = await startMigratedPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    // Only the user and a catalog entry on a twin: the real catalog would
    // make the startup refresh reach the internet.
    await prisma.user.create({ data: { name: 'me' } });
    await prisma.catalogEntry.create({
      data: {
        key: 'twin',
        displayName: 'Twin Catalog',
        authOptions: {
          create: { authType: 'NONE', url: twins.catalog?.url ?? '' },
        },
      },
    });

    stubAppEnv({ DATABASE_URL: postgres.getConnectionUri() });
    vi.stubEnv('ICON_FETCHING', 'true');
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
    refresh = app.get(IconRefreshService);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await postgres?.stop();
    await Promise.all(Object.values(twins).map((twin) => twin.close()));
    vi.unstubAllEnvs();
  });

  it("stores the server's own MCP icon and serves it from our origin (REQ-CONN-070, REQ-CONN-071)", async () => {
    const created = await createConnection('Png Server', twins.png?.url ?? '');
    expect(created.iconUrl).toBe('/icons/letter/P');

    const iconUrl = await waitForStoredIcon(created.id);
    const res = await request(app.getHttpServer()).get(iconUrl).expect(200);
    expect(res.headers['content-type']).toBe('image/png');
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(Buffer.compare(res.body as Buffer, TWIN_PNG)).toBe(0);
  });

  it('refuses HTML labelled image/png and falls back to the favicon', async () => {
    const created = await createConnection(
      'Html Icon',
      twins.htmlThenFavicon?.url ?? '',
    );
    await refresh.refreshConnection(
      created.id,
      twins.htmlThenFavicon?.url ?? '',
    );
    const iconUrl = await iconUrlOf(created.id);
    const res = await request(app.getHttpServer()).get(iconUrl).expect(200);
    expect(res.headers['content-type']).toBe('image/vnd.microsoft.icon');
    expect(Buffer.compare(res.body as Buffer, TWIN_ICO)).toBe(0);
  });

  it('refuses an icon over 256 KB and keeps the letter icon when nothing else works', async () => {
    const created = await createConnection(
      'Oversized',
      twins.oversized?.url ?? '',
    );
    await refresh.refreshConnection(created.id, twins.oversized?.url ?? '');
    expect(await iconUrlOf(created.id)).toBe('/icons/letter/O');
  });

  it('keeps the letter icon for a URL the network rules refuse', async () => {
    const created = await createConnection(
      'Private Host',
      'https://10.0.0.5/mcp',
    );
    await refresh.refreshConnection(created.id, 'https://10.0.0.5/mcp');
    expect(await iconUrlOf(created.id)).toBe('/icons/letter/P');
  });

  it('fetches the icon again when the URL changes', async () => {
    const created = await createConnection(
      'Moving',
      twins.oversized?.url ?? '',
    );
    await refresh.refreshConnection(created.id, twins.oversized?.url ?? '');
    await graphql(
      'mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { id } }',
      { id: created.id, input: { url: twins.png?.url } },
    );
    expect(await waitForStoredIcon(created.id)).toMatch(
      /^\/icons\/[0-9a-f-]{36}$/,
    );
  });

  it('gives catalog entries an icon at startup, shared by their connections', async () => {
    let entry: { id: string; iconUrl: string } | undefined;
    for (
      let attempt = 0;
      attempt < 50 && !entry?.iconUrl.match(/^\/icons\/[0-9a-f-]{36}$/);
      attempt++
    ) {
      const body = await graphql('{ catalog { id iconUrl } }');
      const catalog = (body.data?.catalog ?? []) as unknown as {
        id: string;
        iconUrl: string;
      }[];
      entry = catalog[0];
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    expect(entry?.iconUrl).toMatch(/^\/icons\/[0-9a-f-]{36}$/);

    const switched = await graphql(
      'mutation ($id: ID!) { switchOnCatalogEntry(catalogEntryId: $id, authType: NONE) { iconUrl } }',
      { id: entry?.id },
    );
    expect(switched.data?.switchOnCatalogEntry?.iconUrl).toBe(entry?.iconUrl);
  });

  it('stores identical icons once', async () => {
    expect(
      await prisma.icon.count({ where: { contentType: 'image/png' } }),
    ).toBe(1);
  });

  it('serves a generated letter icon', async () => {
    const res = await request(app.getHttpServer())
      .get('/icons/letter/A')
      .expect(200);
    expect(res.headers['content-type']).toContain('image/svg+xml');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    // supertest keeps an SVG response as bytes.
    expect(Buffer.from(res.body as Buffer).toString('utf8')).toContain(
      '>A</text>',
    );
  });

  it.each([
    '/icons/letter/a',
    '/icons/letter/AB',
    '/icons/not-a-uuid',
    '/icons/0190c3c8-0000-7000-8000-000000000000',
  ])('answers 404 for %s', async (path) => {
    await request(app.getHttpServer()).get(path).expect(404);
  });
});
