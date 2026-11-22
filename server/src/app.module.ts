import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { CallerModule } from './caller/caller.module.js';
import { appConfig } from './config/app.config.js';
import { cryptoConfig } from './config/crypto.config.js';
import { databaseConfig } from './config/database.config.js';
import { envSchema } from './config/env.schema.js';
import { iconsConfig } from './config/icons.config.js';
import { redisConfig } from './config/redis.config.js';
import { CryptoModule } from './crypto/crypto.module.js';
import { DomainErrorFilter } from './errors/domain-error.filter.js';
import { createValidationPipe } from './errors/validation-pipe.js';
import { GraphqlApiModule } from './graphql-api/graphql-api.module.js';
import { HealthModule } from './health/health.module.js';
import { IconsModule } from './icons/icons.module.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { UpstreamsModule } from './upstreams/upstreams.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envSchema,
      load: [appConfig, cryptoConfig, databaseConfig, iconsConfig, redisConfig],
    }),
    PrismaModule,
    HealthModule,
    GraphqlApiModule,
    UpstreamsModule,
    CallerModule,
    CryptoModule,
    IconsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_FILTER, useClass: DomainErrorFilter },
    { provide: APP_PIPE, useFactory: createValidationPipe },
  ],
})
export class AppModule {}
