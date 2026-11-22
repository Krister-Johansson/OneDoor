import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { DEFAULT_USER_NAME } from '../src/auth/caller.js';
import { PrismaClient } from '../src/generated/prisma/client.js';
import type { AuthType } from '../src/generated/prisma/enums.js';

interface CatalogSeed {
  key: string;
  displayName: string;
  description: string;
  authOptions: {
    authType: AuthType;
    url: string;
    headerName?: string;
    headerPrefix?: string;
  }[];
}

// The catalog of pre-installed servers (specs/connections.md, REQ-CONN-010).
// Values checked against each vendor's documentation on 2026-11-22.
export const CATALOG: CatalogSeed[] = [
  {
    key: 'github',
    displayName: 'GitHub',
    description:
      "GitHub's remote MCP server: repositories, issues, pull requests and more.",
    authOptions: [
      {
        // A personal access token. OAuth needs a GitHub OAuth app.
        authType: 'API_KEY',
        url: 'https://api.githubcopilot.com/mcp/',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    ],
  },
  {
    key: 'context7',
    displayName: 'Context7',
    description: 'Up-to-date documentation and code examples for libraries.',
    authOptions: [
      {
        // Context7 offers dynamic client registration.
        authType: 'OAUTH_DCR',
        url: 'https://mcp.context7.com/mcp/oauth',
      },
      {
        authType: 'API_KEY',
        url: 'https://mcp.context7.com/mcp',
        headerName: 'Authorization',
        headerPrefix: 'Bearer',
      },
    ],
  },
];

// Creates and updates the rows every environment needs. Safe to run more
// than once.
export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.user.upsert({
    where: { name: DEFAULT_USER_NAME },
    create: { name: DEFAULT_USER_NAME },
    update: {},
  });

  for (const { authOptions, ...entry } of CATALOG) {
    const { id } = await prisma.catalogEntry.upsert({
      where: { key: entry.key },
      create: entry,
      update: {
        displayName: entry.displayName,
        description: entry.description,
      },
    });
    for (const option of authOptions) {
      const values = {
        url: option.url,
        headerName: option.headerName ?? null,
        headerPrefix: option.headerPrefix ?? null,
      };
      await prisma.catalogAuthOption.upsert({
        where: {
          catalogEntryId_authType: {
            catalogEntryId: id,
            authType: option.authType,
          },
        },
        create: { catalogEntryId: id, authType: option.authType, ...values },
        update: values,
      });
    }
  }
}

// `pnpm prisma db seed` runs this file with tsx.
if (import.meta.main) {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });
  try {
    await seed(prisma);
  } finally {
    await prisma.$disconnect();
  }
}
