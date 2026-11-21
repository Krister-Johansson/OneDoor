import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CallerModule } from './caller/caller.module.js';
import { appConfig } from './config/app.config.js';
import { databaseConfig } from './config/database.config.js';
import { envSchema } from './config/env.schema.js';
import { redisConfig } from './config/redis.config.js';
import { DomainErrorFilter } from './errors/domain-error.filter.js';
import { GraphqlApiModule } from './graphql-api/graphql-api.module.js';
import { HealthModule } from './health/health.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UpstreamsModule } from './upstreams/upstreams.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      load: [appConfig, databaseConfig, redisConfig],
    }),
    PrismaModule,
    HealthModule,
    GraphqlApiModule,
    UpstreamsModule,
    CallerModule,
  ],
  controllers: [AppController],
  providers: [AppService, { provide: APP_FILTER, useClass: DomainErrorFilter }],
})
export class AppModule {}
