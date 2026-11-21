import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { databaseConfig } from '../config/database.config.js';
import { PrismaClient } from '../generated/prisma/client.js';

// The one Prisma client in the app. It opens connections on the first query,
// so the server starts while Postgres is down; readiness reports that state.
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(
    @Inject(databaseConfig.KEY) database: ConfigType<typeof databaseConfig>,
  ) {
    super({ adapter: new PrismaPg({ connectionString: database.url }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
