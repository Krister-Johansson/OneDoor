import { redisConfig } from './redis.config.js';

describe('redisConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to the local Redis', () => {
    vi.stubEnv('REDIS_URL', undefined);
    expect(redisConfig()).toEqual({ url: 'redis://127.0.0.1:6379' });
  });

  it.each(['redis://127.0.0.1:6380', 'rediss://cache.example.test:6380'])(
    'reads REDIS_URL=%s',
    (value) => {
      vi.stubEnv('REDIS_URL', value);
      expect(redisConfig().url).toBe(value);
    },
  );

  it.each(['not a url', 'http://127.0.0.1:6379'])(
    'rejects REDIS_URL=%s',
    (value) => {
      vi.stubEnv('REDIS_URL', value);
      expect(() => redisConfig()).toThrow();
    },
  );
});
