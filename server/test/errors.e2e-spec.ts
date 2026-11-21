import {
  BadRequestException,
  Controller,
  Get,
  type INestApplication,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import type { App } from 'supertest/types.js';
import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  UpstreamUnavailableError,
  ValidationError,
} from '../src/errors/domain-errors.js';

@Controller('throw')
class ThrowingController {
  @Get('not-found')
  notFound() {
    throw new NotFoundError('Connection not found');
  }

  @Get('conflict')
  conflict() {
    throw new ConflictError('Connection already exists');
  }

  @Get('forbidden')
  forbidden() {
    throw new ForbiddenError('Tool is disabled');
  }

  @Get('validation')
  validation() {
    throw new ValidationError('Name is required');
  }

  @Get('upstream')
  upstream() {
    throw new UpstreamUnavailableError('GitHub is unreachable');
  }

  @Get('internal')
  internal() {
    throw new InternalError({ cause: new Error('detail-in-cause') });
  }

  @Get('unknown')
  unknown() {
    throw new Error('detail-in-message');
  }

  @Get('http')
  http() {
    throw new BadRequestException('Bad input');
  }
}

describe('DomainErrorFilter (e2e)', () => {
  let app: INestApplication<App>;

  beforeAll(async () => {
    // No database or Redis is needed. The values only pass config validation.
    vi.stubEnv('DATABASE_URL', 'postgresql://test:test@127.0.0.1:1/test');
    vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1');

    // AppModule registers the filter, so the test uses its real registration.
    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
      controllers: [ThrowingController],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it.each([
    ['not-found', 404, 'NOT_FOUND', 'Connection not found'],
    ['conflict', 409, 'CONFLICT', 'Connection already exists'],
    ['forbidden', 403, 'FORBIDDEN', 'Tool is disabled'],
    ['validation', 400, 'VALIDATION', 'Name is required'],
    ['upstream', 502, 'UPSTREAM_UNAVAILABLE', 'GitHub is unreachable'],
    ['internal', 500, 'INTERNAL', 'Internal server error'],
  ])('GET /throw/%s answers %i %s', async (path, statusCode, code, message) => {
    const res = await request(app.getHttpServer())
      .get(`/throw/${path}`)
      .expect(statusCode);
    expect(res.body).toEqual({ statusCode, code, message });
  });

  it('hides the cause of an internal error', async () => {
    const res = await request(app.getHttpServer()).get('/throw/internal');
    expect(res.text).not.toContain('detail-in-cause');
  });

  it('answers an unknown error as INTERNAL without its message', async () => {
    const res = await request(app.getHttpServer())
      .get('/throw/unknown')
      .expect(500);
    expect(res.body).toEqual({
      statusCode: 500,
      code: 'INTERNAL',
      message: 'Internal server error',
    });
    expect(res.text).not.toContain('detail-in-message');
  });

  it("passes Nest's HttpException through unchanged", async () => {
    const res = await request(app.getHttpServer())
      .get('/throw/http')
      .expect(400);
    expect(res.body).toEqual({
      statusCode: 400,
      message: 'Bad input',
      error: 'Bad Request',
    });
  });

  it('answers an unknown route with Nest 404', async () => {
    const res = await request(app.getHttpServer())
      .get('/no-such-route')
      .expect(404);
    expect(res.body.statusCode).toBe(404);
  });
});
