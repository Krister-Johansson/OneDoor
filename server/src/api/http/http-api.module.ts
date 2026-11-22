import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IconsModule } from '../../services/icons/icons.module.js';
import { HealthController } from './health/health.controller.js';
import { RedisHealthIndicator } from './health/redis.health.js';
import { IconsController } from './icons/icons.controller.js';

// The plain HTTP routes: health checks and icons. Later also the OAuth
// callback and any REST API.
@Module({
  imports: [TerminusModule.forRoot(), PrismaModule, IconsModule],
  controllers: [HealthController, IconsController],
  providers: [RedisHealthIndicator],
})
export class HttpApiModule {}
