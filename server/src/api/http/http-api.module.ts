import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { HealthController } from './health/health.controller.js';
import { RedisHealthIndicator } from './health/redis.health.js';

@Module({
  imports: [TerminusModule.forRoot(), PrismaModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
