import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { eventsConfig } from '../config/events.config.js';
import { redisConfig } from '../config/redis.config.js';
import { EventBus } from './event-bus.js';
import { RedisEventBus } from './redis-event-bus.js';

@Module({
  providers: [
    {
      // Feature code injects the abstract class; config picks the implementation.
      provide: EventBus,
      inject: [eventsConfig.KEY, redisConfig.KEY],
      useFactory: (
        events: ConfigType<typeof eventsConfig>,
        redis: ConfigType<typeof redisConfig>,
      ): EventBus => {
        switch (events.eventBus) {
          case 'redis':
            return new RedisEventBus(redis.url);
        }
      },
    },
  ],
  exports: [EventBus],
})
export class EventsModule {}
