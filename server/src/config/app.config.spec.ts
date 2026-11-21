import { appConfig } from './app.config.js';
import { envSchema } from './env.schema.js';

describe('appConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('defaults to 127.0.0.1:3000 when HOST and PORT are unset', () => {
    vi.stubEnv('HOST', undefined);
    vi.stubEnv('PORT', undefined);

    expect(appConfig()).toEqual({ host: '127.0.0.1', port: 3000 });
  });

  it('reads HOST and coerces PORT to a number', () => {
    vi.stubEnv('HOST', '0.0.0.0');
    vi.stubEnv('PORT', '4000');

    expect(appConfig()).toEqual({ host: '0.0.0.0', port: 4000 });
  });
});

describe('envSchema', () => {
  it.each(['abc', '0', '70000', '3000.5'])('rejects PORT=%s', (port) => {
    expect(envSchema.safeParse({ PORT: port }).success).toBe(false);
  });

  it('rejects an empty HOST', () => {
    expect(envSchema.safeParse({ HOST: '' }).success).toBe(false);
  });
});
