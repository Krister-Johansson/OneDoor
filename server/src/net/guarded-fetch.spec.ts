import {
  startApiKeyTwin,
  startLargeResponseTwin,
  startOpenTwin,
  startRedirectTwin,
  type Twin,
} from '../../test/twins/mcp-twins.js';
import {
  findNetworkRuleError,
  GuardedFetch,
  MAX_RESPONSE_BYTES,
  type ResolveAll,
} from './guarded-fetch.js';

// Resolves *.internal.test to a private address and everything else to
// 127.0.0.1, so no test depends on real DNS.
const fakeResolve: ResolveAll = async (hostname) =>
  hostname.endsWith('internal.test')
    ? [{ address: '10.0.0.5', family: 4 }]
    : [{ address: '127.0.0.1', family: 4 }];

describe('GuardedFetch (REQ-CONN-063)', () => {
  const guarded = new GuardedFetch(fakeResolve);
  const fetch = guarded.create();
  const twins: Twin[] = [];

  async function twin(start: Promise<Twin>): Promise<Twin> {
    const started = await start;
    twins.push(started);
    return started;
  }

  async function refusal(url: string, init?: RequestInit): Promise<string> {
    const error = await fetch(url, init).catch((e: unknown) => e);
    const rule = findNetworkRuleError(error);
    if (!rule)
      throw new Error(`Expected a NetworkRuleError, got ${String(error)}`);
    return rule.message;
  }

  afterAll(async () => {
    await Promise.all(twins.map((t) => t.close()));
    await guarded.onModuleDestroy();
  });

  it('fetches a server on 127.0.0.1', async () => {
    const open = await twin(startOpenTwin());
    const res = await fetch(`${open.origin}/missing`);
    expect(res.status).toBe(404);
  });

  it.each([
    ['cloud metadata', 'https://169.254.169.254/latest/meta-data'],
    ['a private address', 'https://10.0.0.5/mcp'],
    ['IPv6 loopback by literal', 'https://[::1]/mcp'],
  ])('refuses %s before sending a request', async (_name, url) => {
    expect(await refusal(url)).toMatch(
      /private, loopback, link-local or reserved/,
    );
  });

  it('refuses http on another host', async () => {
    expect(await refusal('http://example.com/mcp')).toMatch(/https/);
  });

  it('refuses a host name that resolves to a private address', async () => {
    expect(await refusal('https://api.internal.test/mcp')).toMatch(
      /api\.internal\.test resolves to/,
    );
  });

  it.each([
    ['http to a private address', 'http://10.0.0.5/'],
    ['https to cloud metadata', 'https://169.254.169.254/latest'],
    ['a host that resolves privately', 'https://internal.test/'],
  ])('stops at a redirect to %s', async (_name, location) => {
    const redirect = await twin(startRedirectTwin(location));
    await expect(refusal(redirect.url)).resolves.toEqual(expect.any(String));
  });

  it('stops after three redirects', async () => {
    const loop = await twin(startRedirectTwin((origin) => `${origin}/again`));
    expect(await refusal(loop.url)).toMatch(/More than 3 redirects/);
  });

  it('drops credential headers when a redirect leaves the origin', async () => {
    const keyed = await twin(startApiKeyTwin());
    const redirect = await twin(startRedirectTwin(keyed.url));
    const direct = await fetch(keyed.url, {
      method: 'POST',
      headers: {
        authorization: 'Bearer twin-key',
        'content-type': 'application/json',
      },
      body: '{}',
    });
    expect(direct.status).not.toBe(401);
    const redirected = await fetch(redirect.url, {
      method: 'POST',
      headers: {
        authorization: 'Bearer twin-key',
        'content-type': 'application/json',
      },
      body: '{}',
    });
    expect(redirected.status).toBe(401);
  });

  it('sends a form body as URL-encoded text', async () => {
    const open = await twin(startOpenTwin());
    const res = await fetch(`${open.origin}/missing`, {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'refresh_token' }),
    });
    expect(res.status).toBe(404);
    await expect(
      fetch(`${open.origin}/missing`, {
        method: 'POST',
        body: new Blob(['x']),
      }),
    ).rejects.toThrow(/only string and form bodies/);
  });

  it('refuses to send a secret body to another origin when asked to (T21)', async () => {
    const open = await twin(startOpenTwin());
    const redirect = await twin(startRedirectTwin(`${open.origin}/token`));
    const guardedBody = guarded.create({ bodyStaysOnOrigin: true });
    const error = await guardedBody(redirect.url, {
      method: 'POST',
      body: new URLSearchParams({ refresh_token: 'secret' }),
    }).catch((e: unknown) => e);
    expect(findNetworkRuleError(error)?.message).toMatch(
      /redirected a request body to/,
    );

    // A redirect that turns the request into a GET sends no body.
    const seeOther = await twin(
      startRedirectTwin(`${open.origin}/missing`, 303),
    );
    const res = await guardedBody(seeOther.url, {
      method: 'POST',
      body: new URLSearchParams({ refresh_token: 'secret' }),
    });
    expect(res.status).toBe(404);
  });

  it('fails while reading a body larger than 1 MB', async () => {
    const large = await twin(startLargeResponseTwin(MAX_RESPONSE_BYTES + 1024));
    const res = await fetch(large.url);
    await expect(res.text()).rejects.toThrow(/larger than/);
  });

  it('reads a body under 1 MB', async () => {
    const small = await twin(startLargeResponseTwin(512 * 1024));
    const res = await fetch(small.url);
    expect((await res.text()).length).toBe(512 * 1024);
  });
});
