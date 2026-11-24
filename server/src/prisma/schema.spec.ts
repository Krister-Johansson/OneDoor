import { PrismaPg } from '@prisma/adapter-pg';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { seed } from '../../prisma/seed.js';
import { startMigratedPostgres } from '../../test/support/database.js';
import { DEFAULT_USER_NAME } from '../auth/caller.js';
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
  let optionId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    prisma = new PrismaClient({
      adapter: new PrismaPg({ connectionString: container.getConnectionUri() }),
    });
    await seed(prisma);

    meId = (await prisma.user.findUniqueOrThrow({ where: { name: 'me' } })).id;
    otherId = (await prisma.user.create({ data: { name: 'other' } })).id;
    const entry = await prisma.catalogEntry.create({
      data: {
        key: 'acme',
        displayName: 'Acme',
        authOptions: {
          create: {
            authType: 'API_KEY',
            url: 'https://mcp.acme.test/mcp',
            headerName: 'Authorization',
            headerPrefix: 'Bearer',
          },
        },
      },
      include: { authOptions: true },
    });
    catalogEntryId = entry.id;
    optionId = entry.authOptions[0]?.id ?? '';
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

  it('creates a connection enabled (REQ-CONN-051)', async () => {
    const connection = await custom(meId, 'Defaults');
    expect(connection.enabled).toBe(true);
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
    await prisma.connection.create({
      data: { ownerId: meId, catalogEntryId, catalogAuthOptionId: optionId },
    });
    const error = await prisma.connection
      .create({
        data: { ownerId: meId, catalogEntryId, catalogAuthOptionId: optionId },
      })
      .catch((e: unknown) => e);
    expect(toDomainError(error, 'Connection')).toBeInstanceOf(ConflictError);
    await expect(
      prisma.connection.create({
        data: {
          ownerId: otherId,
          catalogEntryId,
          catalogAuthOptionId: optionId,
        },
      }),
    ).resolves.toBeDefined();
  });

  it('rejects a catalog-based connection with its own URL', async () => {
    await expect(
      prisma.connection.create({
        data: {
          ownerId: otherId,
          catalogEntryId,
          catalogAuthOptionId: optionId,
          url: 'https://evil.test',
        },
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

  it('seeds the GitHub, Context7 and Azure DevOps catalog entries once (REQ-CONN-010, T22)', async () => {
    await seed(prisma);
    const entries = await prisma.catalogEntry.findMany({
      where: { key: { in: ['github', 'context7', 'azure-devops'] } },
      include: { authOptions: { orderBy: { authType: 'asc' } } },
      orderBy: { key: 'asc' },
    });
    expect(
      entries.map((e) => [e.key, e.authOptions.map((o) => o.authType)]),
    ).toEqual([
      ['azure-devops', ['OAUTH_MANUAL']],
      ['context7', ['API_KEY', 'OAUTH_DCR']],
      ['github', ['API_KEY', 'OAUTH_MANUAL']],
    ]);
  });

  it("keeps an option's OAuth app when the seed runs again (T22)", async () => {
    const github = await prisma.catalogEntry.findUniqueOrThrow({
      where: { key: 'github' },
    });
    const where = {
      catalogEntryId_authType: {
        catalogEntryId: github.id,
        authType: 'OAUTH_MANUAL' as const,
      },
    };
    await prisma.catalogAuthOption.update({
      where,
      data: { oauthClientId: 'seed-test-app' },
    });
    await seed(prisma);
    const option = await prisma.catalogAuthOption.findUniqueOrThrow({ where });
    expect(option.oauthClientId).toBe('seed-test-app');
    await prisma.catalogAuthOption.update({
      where,
      data: { oauthClientId: null },
    });
  });

  it('rejects a catalog-based connection without an auth option', async () => {
    const user = await prisma.user.create({ data: { name: 'no-option' } });
    await expect(
      prisma.connection.create({ data: { ownerId: user.id, catalogEntryId } }),
    ).rejects.toThrow(/connection_catalog_or_custom_check/);
  });

  it("rejects another entry's auth option", async () => {
    const user = await prisma.user.create({ data: { name: 'wrong-option' } });
    const github = await prisma.catalogEntry.findUniqueOrThrow({
      where: { key: 'github' },
    });
    await expect(
      prisma.connection.create({
        data: {
          ownerId: user.id,
          catalogEntryId: github.id,
          catalogAuthOptionId: optionId,
        },
      }),
    ).rejects.toThrow(
      /connection_catalog_entry_id_catalog_auth_option_id_fkey/,
    );
  });

  it('requires header settings on an API_KEY auth option', async () => {
    await expect(
      prisma.catalogAuthOption.create({
        data: {
          catalogEntryId,
          authType: 'NONE',
          url: 'https://x.test',
          headerName: 'Authorization',
          headerPrefix: '',
        },
      }),
    ).rejects.toThrow(/catalog_auth_option_api_key_header_check/);
  });

  it('keeps an OAuth app off options other than OAUTH_MANUAL (T22)', async () => {
    await expect(
      prisma.catalogAuthOption.update({
        where: { id: optionId },
        data: { oauthClientId: 'not-here' },
      }),
    ).rejects.toThrow(/catalog_auth_option_oauth_client_auth_check/);
  });

  it('requires a client id with a client secret on an auth option (T22)', async () => {
    await expect(
      prisma.catalogAuthOption.create({
        data: {
          catalogEntryId,
          authType: 'OAUTH_MANUAL',
          url: 'https://x.test',
          oauthClientSecretCiphertext: 'c',
          oauthClientSecretKeyId: 'k',
        },
      }),
    ).rejects.toThrow(/catalog_auth_option_oauth_client_auth_check/);
  });

  it('keeps URL parameters off custom connections (T22)', async () => {
    await expect(
      prisma.connection.create({
        data: {
          ownerId: meId,
          displayName: 'With parameters',
          url: 'https://mcp.example.test/mcp',
          authType: 'NONE',
          urlParameters: { organization: 'contoso' },
        },
      }),
    ).rejects.toThrow(/connection_url_parameters_check/);
  });
});
