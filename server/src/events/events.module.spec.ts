import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { eventsConfig } from '../config/events.config.js';
import { redisConfig } from '../config/redis.config.js';
import { EventBus } from './event-bus.js';
import { EventsModule } from './events.module.js';
import { RedisEventBus } from './redis-event-bus.js';

describe('EventsModule', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('binds EventBus to the bus that EVENT_BUS names', async () => {
    vi.stubEnv('EVENT_BUS', 'redis');
    // Nothing listens here; the bus connects only on first use.
    vi.stubEnv('REDIS_URL', 'redis://127.0.0.1:1');

    const moduleRef = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [eventsConfig, redisConfig],
        }),
        EventsModule,
      ],
    }).compile();

    expect(moduleRef.get(EventBus)).toBeInstanceOf(RedisEventBus);
    await moduleRef.close();
  });
});
