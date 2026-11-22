import { upstreamsConfig } from './upstreams.config.js';

describe('upstreamsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('connects to upstream servers by default', () => {
    vi.stubEnv('UPSTREAM_CONNECTING', undefined);
    expect(upstreamsConfig()).toEqual({ connecting: true });
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
