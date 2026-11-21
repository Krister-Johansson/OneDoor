import { Controller, Get } from '@nestjs/common';
import {
  HealthCheck,
  HealthCheckService,
  PrismaHealthIndicator,
} from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service.js';
import { RedisHealthIndicator } from './redis.health.js';

@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly prisma: PrismaService,
    private readonly redisHealth: RedisHealthIndicator,
  ) {}

  // Liveness: the process answers HTTP. It checks no dependencies, so a
  // database outage does not get the process restarted.
  @Get('live')
  @HealthCheck()
  live() {
    return this.health.check([]);
  }

  // Readiness: the server can do its work. 503 when Postgres or Redis is down.
  @Get('ready')
  @HealthCheck()
  ready() {
    return this.health.check([
      () => this.prismaHealth.pingCheck('postgres', this.prisma),
      () => this.redisHealth.isHealthy('redis'),
    ]);
  }
}
