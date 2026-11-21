import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../prisma/prisma.module.js';
import { HealthController } from './health.controller.js';
import { RedisHealthIndicator } from './redis.health.js';

@Module({
  imports: [TerminusModule.forRoot(), PrismaModule],
  controllers: [HealthController],
  providers: [RedisHealthIndicator],
})
export class HealthModule {}
