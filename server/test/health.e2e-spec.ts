import { randomBytes } from 'node:crypto';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import request from 'supertest';
import type { App } from 'supertest/types.js';

// The same images as docker-compose.yml.
const POSTGRES_IMAGE = 'pgvector/pgvector:0.8.7-pg19-trixie';
const REDIS_IMAGE = 'redis:8.8.4-alpine';

describe('Health routes (e2e)', () => {
  const password = randomBytes(12).toString('hex');
  let postgres: StartedPostgreSqlContainer;
  let redis: StartedRedisContainer;
  let app: INestApplication<App>;

  beforeAll(async () => {
    [postgres, redis] = await Promise.all([
      new PostgreSqlContainer(POSTGRES_IMAGE).withPassword(password).start(),
      new RedisContainer(REDIS_IMAGE).start(),
    ]);
    vi.stubEnv('DATABASE_URL', postgres.getConnectionUri());
    vi.stubEnv('REDIS_URL', redis.getConnectionUrl());

    // Imported after the stubs, so config validation sees the containers.
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  }, 120_000);

  afterAll(async () => {
    await app?.close();
    await Promise.all([postgres?.stop(), redis?.stop()]);
    vi.unstubAllEnvs();
  });

  it('GET /health/live answers 200', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /health/ready answers 200 when Postgres and Redis are up', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(200);
    expect(res.body.details).toMatchObject({
      postgres: { status: 'up' },
      redis: { status: 'up' },
    });
  });

  it('GET /health/ready answers 503 when Redis is down', async () => {
    await redis.stop();
    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(res.body.details).toMatchObject({
      postgres: { status: 'up' },
      redis: { status: 'down' },
    });
  });

  it('GET /health/live still answers 200 when a dependency is down', async () => {
    await postgres.stop();
    await request(app.getHttpServer()).get('/health/live').expect(200);
  });

  it('GET /health/ready answers 503 without the password when Postgres is down', async () => {
    const res = await request(app.getHttpServer())
      .get('/health/ready')
      .expect(503);
    expect(res.body.details.postgres.status).toBe('down');
    expect(res.text).not.toContain(password);
  });
});
