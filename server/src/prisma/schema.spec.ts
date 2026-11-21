import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DEFAULT_USER_NAME, seed } from '../../prisma/seed.js';
import { startMigratedPostgres } from '../../test/support/database.js';
import { ConflictError } from '../errors/domain-errors.js';
import { PrismaClient } from '../generated/prisma/client.js';
import { toDomainError } from './prisma-error.mapper.js';

// Applies the migrations to an empty database and checks the constraints
// that specs/connections.md relies on.
describe('database schema', () => {
  let container: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  let meId: string;
  let otherId: string;
  let catalogEntryId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: container.getConnectionUri() }),
    });
    await seed(prisma);

    meId = (await prisma.user.findUniqueOrThrow({ where: { name: 'me' } })).id;
    otherId = (await prisma.user.create({ data: { name: 'other' } })).id;
    catalogEntryId = (
      await prisma.catalogEntry.create({
        data: {
          key: 'acme',
          displayName: 'Acme',
          url: 'https://mcp.acme.test/mcp',
          authType: 'API_KEY',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
      })
    ).id;
  }, 120_000);

  afterAll(async () => {
    await prisma?.$disconnect();
    await container?.stop();
  });

  function custom(ownerId: string, displayName: string) {
    return prisma.connection.create({
      data: {
        ownerId,
        displayName,
        url: 'https://mcp.example.test/mcp',
        authType: 'NONE',
      },
    });
  }

  it('seeds the user me once, however often the seed runs', async () => {
    await seed(prisma);
    const users = await prisma.user.findMany({
      where: { name: DEFAULT_USER_NAME },
    });
    expect(users).toHaveLength(1);
  });

  it('creates a connection as READ_ONLY and enabled (REQ-CONN-050, REQ-CONN-051)', async () => {
    const connection = await custom(meId, 'Defaults');
    expect(connection).toMatchObject({ mode: 'READ_ONLY', enabled: true });
  });

  it('keeps display names unique per owner, ignoring case (REQ-CONN-021)', async () => {
    await custom(meId, 'Acme Tools');
    const error = await custom(meId, 'ACME TOOLS').catch((e: unknown) => e);
    expect(toDomainError(error, 'Connection')).toBeInstanceOf(ConflictError);
  });

  it('allows the same display name for different owners (REQ-CONN-002)', async () => {
    await custom(meId, 'Shared Name');
    await expect(custom(otherId, 'Shared Name')).resolves.toBeDefined();
  });

  it('allows one connection per catalog entry per owner (REQ-CONN-012)', async () => {
    await prisma.connection.create({ data: { ownerId: meId, catalogEntryId } });
    const error = await prisma.connection
      .create({ data: { ownerId: meId, catalogEntryId } })
      .catch((e: unknown) => e);
    expect(toDomainError(error, 'Connection')).toBeInstanceOf(ConflictError);
    await expect(
      prisma.connection.create({ data: { ownerId: otherId, catalogEntryId } }),
    ).resolves.toBeDefined();
  });

  it('rejects a catalog-based connection with its own URL', async () => {
    await expect(
      prisma.connection.create({
        data: { ownerId: otherId, catalogEntryId, url: 'https://evil.test' },
      }),
    ).rejects.toThrow(/connection_catalog_or_custom_check/);
  });

  it('rejects a custom connection without a URL', async () => {
    await expect(
      prisma.connection.create({
        data: { ownerId: meId, displayName: 'No URL', authType: 'NONE' },
      }),
    ).rejects.toThrow(/connection_catalog_or_custom_check/);
  });

  it('requires header settings for API_KEY and only for API_KEY', async () => {
    const base = {
      ownerId: meId,
      url: 'https://mcp.example.test/mcp',
    };
    await expect(
      prisma.connection.create({
        data: {
          ...base,
          displayName: 'Key without header',
          authType: 'API_KEY',
        },
      }),
    ).rejects.toThrow(/connection_api_key_header_check/);
    await expect(
      prisma.connection.create({
        data: {
          ...base,
          displayName: 'Header without key',
          authType: 'NONE',
          headerName: 'Authorization',
          headerPrefix: 'Bearer',
        },
      }),
    ).rejects.toThrow(/connection_api_key_header_check/);
    await expect(
      prisma.connection.create({
        data: {
          ...base,
          displayName: 'Key with header',
          authType: 'API_KEY',
          headerName: 'X-Api-Key',
          headerPrefix: '',
        },
      }),
    ).resolves.toBeDefined();
  });

  it('refuses to delete a catalog entry that connections use', async () => {
    const error = await prisma.catalogEntry
      .delete({ where: { id: catalogEntryId } })
      .catch((e: unknown) => e);
    expect(toDomainError(error, 'Catalog entry')).toBeInstanceOf(ConflictError);
  });
});
