import { upstreamsConfig } from './upstreams.config.js';

describe('upstreamsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('connects to upstream servers, and takes OAuth callbacks through the web server, by default', () => {
    vi.stubEnv('UPSTREAM_CONNECTING', undefined);
    vi.stubEnv('OAUTH_REDIRECT_URL', undefined);
    expect(upstreamsConfig()).toEqual({
      connecting: true,
      oauthRedirectUrl: 'http://localhost:3001/oauth/callback',
    });
  });

  it('reads OAUTH_REDIRECT_URL and rejects one that is not http or https', () => {
    vi.stubEnv('OAUTH_REDIRECT_URL', 'https://onedoor.example/oauth/callback');
    expect(upstreamsConfig().oauthRedirectUrl).toBe(
      'https://onedoor.example/oauth/callback',
    );
    vi.stubEnv('OAUTH_REDIRECT_URL', 'javascript:alert(1)');
    expect(() => upstreamsConfig()).toThrow();
  });

  it.each([
    ['false', false],
    ['0', false],
    ['true', true],
  ])('reads UPSTREAM_CONNECTING=%s', (value, connecting) => {
    vi.stubEnv('UPSTREAM_CONNECTING', value);
    expect(upstreamsConfig().connecting).toBe(connecting);
  });

  it('rejects a value that is not a boolean', () => {
    vi.stubEnv('UPSTREAM_CONNECTING', 'sometimes');
    expect(() => upstreamsConfig()).toThrow();
  });
});
