import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from '@testcontainers/postgresql';

const execFileAsync = promisify(execFile);

// The same image as docker-compose.yml.
export const POSTGRES_IMAGE = 'pgvector/pgvector:0.8.7-pg19-trixie';

// Starts a Postgres container and applies every migration with
// `prisma migrate deploy`, the command that runs in production.
export async function startMigratedPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  await execFileAsync('pnpm', ['exec', 'prisma', 'migrate', 'deploy'], {
    env: { ...process.env, DATABASE_URL: container.getConnectionUri() },
  });
  return container;
}
