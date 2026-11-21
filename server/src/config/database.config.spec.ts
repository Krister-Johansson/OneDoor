import { databaseConfig } from './database.config.js';

describe('databaseConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('reads DATABASE_URL', () => {
    vi.stubEnv('DATABASE_URL', 'postgresql://user:pass@localhost:5432/onedoor');
    expect(databaseConfig()).toEqual({
      url: 'postgresql://user:pass@localhost:5432/onedoor',
    });
  });

  it('accepts the postgres:// scheme', () => {
    vi.stubEnv('DATABASE_URL', 'postgres://user:pass@localhost:5432/onedoor');
    expect(databaseConfig().url).toBe(
      'postgres://user:pass@localhost:5432/onedoor',
    );
  });

  it('rejects a missing DATABASE_URL', () => {
    vi.stubEnv('DATABASE_URL', undefined);
    expect(() => databaseConfig()).toThrow();
  });

  it.each([
    'not a url',
    'mysql://user:pass@localhost:3306/onedoor',
    'https://localhost',
  ])('rejects DATABASE_URL=%s', (value) => {
    vi.stubEnv('DATABASE_URL', value);
    expect(() => databaseConfig()).toThrow();
  });
});
