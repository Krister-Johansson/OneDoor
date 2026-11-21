import { randomBytes } from 'node:crypto';

// Stubs every variable that AppModule's config validation requires, with
// values that are safe in tests, so no test depends on server/.env. Pass the
// URLs of real services where a test needs them; the defaults point at ports
// where nothing listens. Restore with vi.unstubAllEnvs().
export function stubAppEnv(
  urls: { DATABASE_URL?: string; REDIS_URL?: string } = {},
): void {
  vi.stubEnv(
    'DATABASE_URL',
    urls.DATABASE_URL ?? 'postgresql://test:test@127.0.0.1:1/test',
  );
  vi.stubEnv('REDIS_URL', urls.REDIS_URL ?? 'redis://127.0.0.1:1');
  vi.stubEnv('SECRET_STORE_KEY_ID', 'test-1');
  vi.stubEnv('SECRET_STORE_KEY', randomBytes(32).toString('base64'));
}
