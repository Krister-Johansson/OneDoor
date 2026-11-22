import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { redisConfig } from '../config/redis.config.js';

// BullMQ on the Redis from REDIS_URL. A service module imports this module
// and registers its own queues with BullModule.registerQueue.
//
// Workers start only when a module calls BullRegistrar.register(), so a
// server that does no background work (tests, UPSTREAM_CONNECTING=false)
// runs no workers.
@Module({
  imports: [
    BullModule.forRootAsync({
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>) => ({
        connection: { url: redis.url },
      }),
      extraOptions: { manualRegistration: true },
    }),
  ],
  exports: [BullModule],
})
export class QueueModule {}
