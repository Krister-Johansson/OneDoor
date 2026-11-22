import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { HealthIndicatorService } from '@nestjs/terminus';
import { Redis } from 'ioredis';
import { redisConfig } from '../../../config/redis.config.js';

// Pings Redis over its own connection. A ping sent while ioredis is still
// connecting waits for the connection, up to the 1 s timeout. With
// maxRetriesPerRequest at 1, queued pings fail after one reconnect attempt,
// so they do not pile up while Redis is down.
@Injectable()
export class RedisHealthIndicator implements OnModuleDestroy {
  private readonly logger = new Logger(RedisHealthIndicator.name);
  private readonly client: Redis;
  private failureLogged = false;

  constructor(
    private readonly healthIndicatorService: HealthIndicatorService,
    @Inject(redisConfig.KEY) redis: ConfigType<typeof redisConfig>,
  ) {
    this.client = new Redis(redis.url, { maxRetriesPerRequest: 1 });
    this.client.on('ready', () => {
      this.failureLogged = false;
    });
    // ioredis reconnects on its own and emits an error on every attempt.
    // Log the first one per outage.
    this.client.on('error', (error: Error) => {
      if (this.failureLogged) return;
      this.failureLogged = true;
      this.logger.warn(`Redis connection failed: ${error.message}`);
    });
  }

  isHealthy<Key extends string>(key: Key) {
    return this.healthIndicatorService
      .check(key)
      .attempt(async () => {
        await this.client.ping();
      })
      .withTimeout(1000);
  }

  onModuleDestroy(): void {
    this.client.disconnect();
  }
}
