import {
  RedisContainer,
  type StartedRedisContainer,
} from '@testcontainers/redis';
import { Redis } from 'ioredis';
import { defineTopic } from './event-bus.js';
import { RedisEventBus } from './redis-event-bus.js';

// The same image as docker-compose.yml.
const REDIS_IMAGE = 'redis:8.8.4-alpine';

interface Ping {
  id: string;
  ownerId: string;
}
const PINGS = defineTopic<Ping>('pings');

describe('RedisEventBus', () => {
  let container: StartedRedisContainer;
  let bus: RedisEventBus;
  let other: RedisEventBus;
  let inspector: Redis;

  // How many Redis subscriptions the channel has, across all connections.
  async function subscriptions(channel: string): Promise<number> {
    const reply = (await inspector.pubsub('NUMSUB', channel)) as [
      string,
      number,
    ];
    return reply[1];
  }

  beforeAll(async () => {
    container = await new RedisContainer(REDIS_IMAGE).start();
    inspector = new Redis(container.getConnectionUrl());
  }, 120_000);

  beforeEach(() => {
    bus = new RedisEventBus(container.getConnectionUrl());
    other = new RedisEventBus(container.getConnectionUrl());
  });

  afterEach(() => {
    bus.onModuleDestroy();
    other.onModuleDestroy();
  });

  afterAll(async () => {
    inspector?.disconnect();
    await container?.stop();
  });

  it('delivers an event to a subscriber of another instance', async () => {
    const events = await bus.subscribe(PINGS);
    await other.publish(PINGS, { id: 'a', ownerId: 'me' });
    await expect(events.next()).resolves.toEqual({
      value: { id: 'a', ownerId: 'me' },
      done: false,
    });
    await events.return?.();
  });

  it('keeps the order of events and queues those not read yet', async () => {
    const events = await bus.subscribe(PINGS);
    await bus.publish(PINGS, { id: '1', ownerId: 'me' });
    await bus.publish(PINGS, { id: '2', ownerId: 'me' });
    await bus.publish(PINGS, { id: '3', ownerId: 'me' });
    const ids: string[] = [];
    for await (const event of events) {
      ids.push(event.id);
      if (ids.length === 3) break;
    }
    expect(ids).toEqual(['1', '2', '3']);
  });

  it('delivers only the events that pass the filter', async () => {
    const mine = await bus.subscribe(PINGS, (event) => event.ownerId === 'me');
    await bus.publish(PINGS, { id: 'theirs', ownerId: 'other' });
    await bus.publish(PINGS, { id: 'mine', ownerId: 'me' });
    await expect(mine.next()).resolves.toMatchObject({
      value: { id: 'mine' },
    });
    await mine.return?.();
  });

  it('shares one Redis subscription per topic and drops it after the last return()', async () => {
    const first = await bus.subscribe(PINGS);
    const second = await bus.subscribe(PINGS);
    expect(await subscriptions('onedoor:pings')).toBe(1);

    await bus.publish(PINGS, { id: 'both', ownerId: 'me' });
    await expect(first.next()).resolves.toMatchObject({
      value: { id: 'both' },
    });
    await expect(second.next()).resolves.toMatchObject({
      value: { id: 'both' },
    });

    await first.return?.();
    expect(await subscriptions('onedoor:pings')).toBe(1);
    await second.return?.();
    await vi.waitFor(async () =>
      expect(await subscriptions('onedoor:pings')).toBe(0),
    );
  });

  it('ends a pending next() when return() is called', async () => {
    const events = await bus.subscribe(PINGS);
    const pending = events.next();
    await events.return?.();
    await expect(pending).resolves.toEqual({ value: undefined, done: true });
    await expect(events.next()).resolves.toEqual({
      value: undefined,
      done: true,
    });
  });

  it('drops a message that is not JSON', async () => {
    const events = await bus.subscribe(PINGS);
    await inspector.publish('onedoor:pings', 'not json');
    await bus.publish(PINGS, { id: 'after', ownerId: 'me' });
    await expect(events.next()).resolves.toMatchObject({
      value: { id: 'after' },
    });
    await events.return?.();
  });

  it('fails to subscribe when Redis cannot be reached', async () => {
    const offline = new RedisEventBus('redis://127.0.0.1:1');
    try {
      await expect(offline.subscribe(PINGS)).rejects.toThrow();
      await expect(
        offline.publish(PINGS, { id: 'x', ownerId: 'me' }),
      ).rejects.toThrow();
    } finally {
      offline.onModuleDestroy();
    }
  });
});
