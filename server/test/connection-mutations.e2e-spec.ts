import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { seed } from '../prisma/seed.js';
import { SecretStore } from '../src/crypto/secret-store.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { startMigratedPostgres } from './support/database.js';
import { stubAppEnv } from './support/env.js';

const FIELDS = `
  id displayName description url authType headerName headerPrefix
  hasApiKey oauthClientId hasClientSecret setupState enabled
`;
const API_KEY = 'ghp_test-key-that-must-never-be-returned';

describe('connection mutations (e2e)', () => {
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let app: INestApplication<App>;
  let secretStore: SecretStore;
  let otherConnectionId: string;
  let catalogConnectionId: string;

  async function graphql(query: string, variables?: Record<string, unknown>) {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    // No response, success or error, ever contains a stored secret.
    expect(res.text).not.toContain(API_KEY);
    return res.body as {
      data?: Record<string, Record<string, unknown> | string | null> | null;
      errors?: { message: string; extensions: { code: string } }[];
    };
  }

  function create(input: Record<string, unknown>) {
    return graphql(
      `mutation ($input: CreateConnectionInput!) { createConnection(input: $input) { ${FIELDS} } }`,
      { input },
    );
  }

  function update(id: string, input: Record<string, unknown>) {
    return graphql(
      `mutation ($id: ID!, $input: UpdateConnectionInput!) { updateConnection(id: $id, input: $input) { ${FIELDS} } }`,
      { id, input },
    );
  }

  function codeOf(body: Awaited<ReturnType<typeof graphql>>) {
    return body.errors?.[0]?.extensions.code;
  }

  async function createApiKeyConnection(displayName: string) {
    const body = await create({
      displayName,
      url: 'https://keyed.test/mcp',
      authType: 'API_KEY',
      apiKey: API_KEY,
    });
    return body.data?.createConnection as Record<string, unknown>;
  }

  beforeAll(async () => {
    postgres = await startMigratedPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: postgres.getConnectionUri() }),
    });
    await seed(prisma);
    const me = await prisma.user.findUniqueOrThrow({ where: { name: 'me' } });
    const other = await prisma.user.create({ data: { name: 'other' } });
    otherConnectionId = (
      await prisma.connection.create({
        data: {
          ownerId: other.id,
          displayName: 'Theirs',
          url: 'https://theirs.test/mcp',
          authType: 'NONE',
        },
      })
    ).id;
    const entry = await prisma.catalogEntry.create({
      data: {
        key: 'catalog',
        displayName: 'Catalog Server',
        authOptions: {
          create: { authType: 'NONE', url: 'https://catalog.test/mcp' },
        },
      },
      include: { authOptions: true },
    });
    catalogConnectionId = (
      await prisma.connection.create({
        data: {
          ownerId: me.id,
          catalogEntryId: entry.id,
          catalogAuthOptionId: entry.authOptions[0]?.id,
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
    secretStore = app.get(SecretStore);
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await prisma?.$disconnect();
    await postgres?.stop();
    vi.unstubAllEnvs();
  });

  describe('createConnection', () => {
    it('adds a server without authentication, enabled and READY (REQ-CONN-020)', async () => {
      const body = await create({
        displayName: '  Acme MCP  ',
        url: 'https://mcp.example.com/mcp',
        authType: 'NONE',
      });
      expect(body.errors).toBeUndefined();
      expect(body.data?.createConnection).toMatchObject({
        displayName: 'Acme MCP',
        description: '',
        authType: 'NONE',
        headerName: null,
        hasApiKey: false,
        setupState: 'READY',
        enabled: true,
      });
    });

    it('stores only the encrypted API key, bound to its row (REQ-CONN-041)', async () => {
      const created = await createApiKeyConnection('Keyed');
      expect(created).toMatchObject({
        authType: 'API_KEY',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
        hasApiKey: true,
        setupState: 'READY',
      });

      const row = await prisma.connection.findUniqueOrThrow({
        where: { id: created.id as string },
      });
      expect(row.apiKeyCiphertext).not.toContain(API_KEY);
      expect(row.apiKeyKeyId).toBe('test-1');
      const secret = {
        ciphertext: row.apiKeyCiphertext as string,
        keyId: row.apiKeyKeyId as string,
      };
      await expect(
        secretStore.decrypt(secret, `connection:${row.id}:api_key`),
      ).resolves.toBe(API_KEY);
      await expect(
        secretStore.decrypt(secret, `connection:${otherConnectionId}:api_key`),
      ).rejects.toThrow();
    });

    it('keeps custom header settings, including an empty prefix', async () => {
      const body = await create({
        displayName: 'Custom Header',
        url: 'https://header.test/mcp',
        authType: 'API_KEY',
        apiKey: API_KEY,
        headerName: 'X-Api-Key',
        headerPrefix: '',
      });
      expect(body.data?.createConnection).toMatchObject({
        headerName: 'X-Api-Key',
        headerPrefix: '',
      });
    });

    it('stores OAuth client details for OAUTH_MANUAL', async () => {
      const body = await create({
        displayName: 'Manual OAuth',
        url: 'https://oauth.test/mcp',
        authType: 'OAUTH_MANUAL',
        oauthClientId: 'client-1',
        oauthClientSecret: API_KEY,
      });
      expect(body.data?.createConnection).toMatchObject({
        oauthClientId: 'client-1',
        hasClientSecret: true,
        setupState: 'NEEDS_CREDENTIALS',
      });
    });

    it.each([
      ['API_KEY without a key', { authType: 'API_KEY' }],
      ['an API key for NONE', { authType: 'NONE', apiKey: API_KEY }],
      [
        'OAUTH_MANUAL without client details',
        { authType: 'OAUTH_MANUAL', oauthClientId: 'client-1' },
      ],
      [
        'http on another host',
        { authType: 'NONE', url: 'http://mcp.example.com/mcp' },
      ],
      [
        'credentials in the URL',
        { authType: 'NONE', url: 'https://user:pass@mcp.example.com/mcp' },
      ],
      ['a display name of spaces', { authType: 'NONE', displayName: '   ' }],
      [
        'a reserved header name',
        { authType: 'API_KEY', apiKey: API_KEY, headerName: 'Host' },
      ],
      [
        'a line break in the API key',
        { authType: 'API_KEY', apiKey: `${API_KEY}\r\nX-Evil: 1` },
      ],
    ])('answers VALIDATION for %s', async (_name, fields) => {
      const body = await create({
        displayName: 'Invalid',
        url: 'https://invalid.test/mcp',
        ...fields,
      });
      expect(codeOf(body)).toBe('VALIDATION');
    });

    it('accepts http on localhost (REQ-CONN-022)', async () => {
      const body = await create({
        displayName: 'Local Twin',
        url: 'http://localhost:4000/mcp',
        authType: 'NONE',
      });
      expect(body.errors).toBeUndefined();
    });

    it('answers CONFLICT for a name in use, ignoring case (REQ-CONN-021)', async () => {
      await create({
        displayName: 'Duplicate',
        url: 'https://dup.test/mcp',
        authType: 'NONE',
      });
      const body = await create({
        displayName: 'DUPLICATE',
        url: 'https://dup.test/mcp',
        authType: 'NONE',
      });
      expect(codeOf(body)).toBe('CONFLICT');
    });

    it('answers CONFLICT for the name of a switched-on catalog server', async () => {
      const body = await create({
        displayName: 'catalog server',
        url: 'https://dup.test/mcp',
        authType: 'NONE',
      });
      expect(codeOf(body)).toBe('CONFLICT');
    });
  });

  describe('updateConnection', () => {
    it('keeps a secret that is left out, deletes it on null, replaces it on a string (REQ-CONN-042)', async () => {
      const { id } = await createApiKeyConnection('Secret Changes');

      let body = await update(id as string, { description: 'Now described' });
      expect(body.data?.updateConnection).toMatchObject({
        description: 'Now described',
        hasApiKey: true,
        setupState: 'READY',
      });

      body = await update(id as string, { apiKey: null });
      expect(body.data?.updateConnection).toMatchObject({
        hasApiKey: false,
        setupState: 'NEEDS_CREDENTIALS',
      });

      body = await update(id as string, { apiKey: `${API_KEY}-2` });
      expect(body.data?.updateConnection).toMatchObject({ hasApiKey: true });
      const row = await prisma.connection.findUniqueOrThrow({
        where: { id: id as string },
      });
      await expect(
        secretStore.decrypt(
          {
            ciphertext: row.apiKeyCiphertext as string,
            keyId: row.apiKeyKeyId as string,
          },
          `connection:${row.id}:api_key`,
        ),
      ).resolves.toBe(`${API_KEY}-2`);
    });

    it('deletes the key when the URL changes without a new key (REQ-CONN-023)', async () => {
      const { id } = await createApiKeyConnection('Moved');
      const body = await update(id as string, {
        url: 'https://moved.test/mcp',
      });
      expect(body.data?.updateConnection).toMatchObject({
        url: 'https://moved.test/mcp',
        hasApiKey: false,
        setupState: 'NEEDS_CREDENTIALS',
      });
    });

    it('stores a new key sent with the new URL (REQ-CONN-023)', async () => {
      const { id } = await createApiKeyConnection('Moved With Key');
      const body = await update(id as string, {
        url: 'https://moved.test/mcp',
        apiKey: `${API_KEY}-3`,
      });
      expect(body.data?.updateConnection).toMatchObject({
        hasApiKey: true,
        setupState: 'READY',
      });
    });

    it('clears the key and headers when the auth type changes to NONE', async () => {
      const { id } = await createApiKeyConnection('Now Open');
      const body = await update(id as string, { authType: 'NONE' });
      expect(body.data?.updateConnection).toMatchObject({
        authType: 'NONE',
        headerName: null,
        headerPrefix: null,
        hasApiKey: false,
        setupState: 'READY',
      });
    });

    it.each([
      ['a setting', { description: 'x' }],
      ['an API key for its NONE option', { apiKey: API_KEY }],
    ])(
      'answers VALIDATION for %s of a catalog-based connection (REQ-CONN-013)',
      async (_name, input) => {
        const body = await update(catalogConnectionId, input);
        expect(codeOf(body)).toBe('VALIDATION');
      },
    );

    it("answers NOT_FOUND for another user's connection", async () => {
      const body = await update(otherConnectionId, { description: 'x' });
      expect(codeOf(body)).toBe('NOT_FOUND');
    });
  });

  describe('setConnectionEnabled and removeConnection', () => {
    it('disables and enables a connection (REQ-CONN-051)', async () => {
      const { id } = await createApiKeyConnection('Toggle');
      const toggle = (enabled: boolean) =>
        graphql(
          'mutation ($id: ID!, $enabled: Boolean!) { setConnectionEnabled(id: $id, enabled: $enabled) { enabled hasApiKey } }',
          { id, enabled },
        );
      expect((await toggle(false)).data?.setConnectionEnabled).toEqual({
        enabled: false,
        hasApiKey: true,
      });
      expect((await toggle(true)).data?.setConnectionEnabled).toEqual({
        enabled: true,
        hasApiKey: true,
      });
    });

    it('removes a connection with its key (REQ-CONN-052)', async () => {
      const { id } = await createApiKeyConnection('Removed');
      const remove = () =>
        graphql('mutation ($id: ID!) { removeConnection(id: $id) }', { id });

      expect((await remove()).data?.removeConnection).toBe(id);
      expect(
        await prisma.connection.findUnique({ where: { id: id as string } }),
      ).toBeNull();
      expect(codeOf(await remove())).toBe('NOT_FOUND');
    });

    it("answers NOT_FOUND for another user's connection", async () => {
      const body = await graphql(
        'mutation ($id: ID!) { removeConnection(id: $id) }',
        { id: otherConnectionId },
      );
      expect(codeOf(body)).toBe('NOT_FOUND');
      expect(
        await prisma.connection.findUnique({
          where: { id: otherConnectionId },
        }),
      ).not.toBeNull();
    });
  });
});
