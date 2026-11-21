import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';

// The name of the only user in the proof of concept (REQ-CONN-001).
export const DEFAULT_USER_NAME = 'me';

// Creates the rows every environment needs. Safe to run more than once.
export async function seed(prisma: PrismaClient): Promise<void> {
  await prisma.user.upsert({
    where: { name: DEFAULT_USER_NAME },
    create: { name: DEFAULT_USER_NAME },
    update: {},
  });
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
