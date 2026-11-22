import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import { CallerService } from '../src/caller/caller.service.js';
import { stubAppEnv } from './support/env.js';
import {
  startApiKeyTwin,
  startHtmlTwin,
  startOAuthTwin,
  startOpenTwin,
  startRedirectTwin,
  type Twin,
} from './twins/mcp-twins.js';

const WRONG_KEY = 'wrong-key-that-must-never-be-returned';

interface GraphqlBody {
  data?: Record<string, Record<string, unknown>> | null;
  errors?: { message: string; extensions: { code: string } }[];
}

describe('probeServer and checkCredentials (e2e)', () => {
  let app: INestApplication<App>;
  const twins: Record<string, Twin> = {};

  async function graphql(
    query: string,
    variables: Record<string, unknown>,
  ): Promise<GraphqlBody> {
    const res = await request(app.getHttpServer())
      .post('/graphql')
      .send({ query, variables })
      .expect(200);
    expect(res.text).not.toContain(WRONG_KEY);
    expect(res.text).not.toContain('twin-key');
    return res.body as GraphqlBody;
  }

  async function probe(url: string) {
    const body = await graphql(
      `mutation ($url: String!) {
        probeServer(url: $url) {
          status message authRequired oauth oauthDcr suggestedAuthType
          serverName serverTitle serverVersion serverDescription iconUrls
        }
      }`,
      { url },
    );
    return body;
  }

  async function check(input: Record<string, unknown>) {
    return graphql(
      `mutation ($input: CheckCredentialsInput!) {
        checkCredentials(input: $input) { status message toolCount toolNames }
      }`,
      { input },
    );
  }

  beforeAll(async () => {
    [twins.open, twins.apiKey, twins.oauth, twins.html, twins.toPrivate] =
      await Promise.all([
        startOpenTwin(),
        startApiKeyTwin(),
        startOAuthTwin(),
        startHtmlTwin(),
        startRedirectTwin('http://10.0.0.5/mcp'),
      ]);

    // The probe needs no database. GraphQL requests need a caller.
    stubAppEnv();
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CallerService)
      .useValue({ getDefaultCaller: async () => ({ userId: 'test' }) })
      .compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    await Promise.all(Object.values(twins).map((twin) => twin.close()));
    vi.unstubAllEnvs();
  });

  describe('probeServer (REQ-CONN-060, REQ-CONN-061)', () => {
    it('reads the name and title of a server without auth', async () => {
      const body = await probe(twins.open?.url ?? '');
      expect(body.data?.probeServer).toEqual({
        status: 'MCP_SERVER',
        message: expect.any(String),
        authRequired: false,
        oauth: false,
        oauthDcr: false,
        suggestedAuthType: 'NONE',
        serverName: 'open-twin',
        serverTitle: 'Open Twin',
        serverVersion: '1.2.3',
        serverDescription: 'A fake MCP server without authentication.',
        iconUrls: [],
      });
    });

    it('finds OAuth with dynamic client registration behind a 401', async () => {
      const body = await probe(twins.oauth?.url ?? '');
      expect(body.data?.probeServer).toMatchObject({
        status: 'AUTH_REQUIRED',
        authRequired: true,
        oauth: true,
        oauthDcr: true,
        suggestedAuthType: 'OAUTH_DCR',
        serverName: null,
      });
    });

    it('suggests an API key when the server needs auth without OAuth', async () => {
      const body = await probe(twins.apiKey?.url ?? '');
      expect(body.data?.probeServer).toMatchObject({
        status: 'AUTH_REQUIRED',
        authRequired: true,
        oauth: false,
        oauthDcr: false,
        suggestedAuthType: 'API_KEY',
      });
    });

    it('reports a web server that is not MCP', async () => {
      const body = await probe(twins.html?.url ?? '');
      expect(body.data?.probeServer).toMatchObject({
        status: 'NOT_MCP',
        suggestedAuthType: null,
      });
    });

    it.each([
      ['cloud metadata', () => 'https://169.254.169.254/latest'],
      ['a redirect to a private address', () => twins.toPrivate?.url ?? ''],
    ])('refuses %s (REQ-CONN-063)', async (_name, url) => {
      const body = await probe(url());
      expect(body.data?.probeServer).toMatchObject({ status: 'REFUSED' });
    });

    it('reports a server that does not answer', async () => {
      const body = await probe('http://127.0.0.1:1/mcp');
      expect(body.data?.probeServer).toMatchObject({
        status: 'UNREACHABLE',
        message: 'The server could not be reached.',
      });
    });

    it('answers VALIDATION for a URL the rules never allow', async () => {
      const body = await probe('http://example.com/mcp');
      expect(body.errors?.[0]?.extensions.code).toBe('VALIDATION');
    });
  });

  describe('checkCredentials (REQ-CONN-062)', () => {
    it('lists the tool count and the first five tool names for a valid key', async () => {
      const body = await check({
        url: twins.apiKey?.url,
        authType: 'API_KEY',
        apiKey: 'twin-key',
      });
      expect(body.data?.checkCredentials).toEqual({
        status: 'OK',
        message: 'Connected. The server has 6 tools.',
        toolCount: 6,
        toolNames: ['one', 'two', 'three', 'four', 'five'],
      });
    });

    it('reports refused credentials without repeating the key', async () => {
      const body = await check({
        url: twins.apiKey?.url,
        authType: 'API_KEY',
        apiKey: WRONG_KEY,
      });
      expect(body.data?.checkCredentials).toEqual({
        status: 'REFUSED_CREDENTIALS',
        message: 'The server refused the credentials.',
        toolCount: null,
        toolNames: [],
      });
    });

    it('checks a server without auth', async () => {
      const body = await check({ url: twins.open?.url, authType: 'NONE' });
      expect(body.data?.checkCredentials).toMatchObject({
        status: 'OK',
        toolCount: 2,
        toolNames: ['echo', 'reverse'],
      });
    });

    it.each([
      ['an OAuth auth type', { authType: 'OAUTH_DCR' }],
      ['API_KEY without a key', { authType: 'API_KEY' }],
      ['an API key for NONE', { authType: 'NONE', apiKey: WRONG_KEY }],
    ])('answers VALIDATION for %s', async (_name, fields) => {
      const body = await check({ url: twins.apiKey?.url, ...fields });
      expect(body.errors?.[0]?.extensions.code).toBe('VALIDATION');
    });
  });
});
