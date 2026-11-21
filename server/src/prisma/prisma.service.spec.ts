import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';
import { databaseConfig } from '../config/database.config.js';
import { PrismaModule } from './prisma.module.js';
import { PrismaService } from './prisma.service.js';

// The same image as docker-compose.yml.
const POSTGRES_IMAGE = 'pgvector/pgvector:0.8.7-pg19-trixie';

describe('PrismaService against Postgres', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let prisma: PrismaService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
    vi.stubEnv('DATABASE_URL', container.getConnectionUri());

    moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [databaseConfig],
        }),
        PrismaModule,
      ],
    }).compile();
    prisma = moduleRef.get(PrismaService);
  }, 120_000);

  afterAll(async () => {
    await moduleRef?.close();
    await container?.stop();
    vi.unstubAllEnvs();
  });

  it('queries the database named in DATABASE_URL', async () => {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      select current_database() as name
    `;
    expect(rows).toEqual([{ name: container.getDatabase() }]);
  });

  it('runs on a server that offers the vector and pg_trgm extensions', async () => {
    const rows = await prisma.$queryRaw<{ name: string }[]>`
      select name from pg_available_extensions
      where name in ('vector', 'pg_trgm')
      order by name
    `;
    expect(rows).toEqual([{ name: 'pg_trgm' }, { name: 'vector' }]);
  });
});
