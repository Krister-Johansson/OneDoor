import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { EventBus, type Topic } from './event-bus.js';

type Listener = (payload: unknown) => void;

// The listeners of one Redis channel, and the SUBSCRIBE that serves them.
interface Channel {
  listeners: Set<Listener>;
  subscribed: Promise<void>;
}

// EventBus on Redis pub/sub. One connection publishes; a second one, in
// subscriber mode, holds one Redis subscription per topic for all local
// subscribers. Both connect on first use, and ioredis subscribes again
// after a reconnect.
export class RedisEventBus extends EventBus implements OnModuleDestroy {
  readonly id = 'redis';
  private readonly logger = new Logger(RedisEventBus.name);
  private readonly publisher: Redis;
  private readonly subscriber: Redis;
  private readonly channels = new Map<string, Channel>();
  private failureLogged = false;

  // `channelPrefix` keeps OneDoor's channels apart from other users of the
  // same Redis.
  constructor(
    url: string,
    private readonly channelPrefix = 'onedoor:',
  ) {
    super();
    const options = { lazyConnect: true, maxRetriesPerRequest: 1 };
    this.publisher = new Redis(url, options);
    this.subscriber = new Redis(url, options);
    for (const client of [this.publisher, this.subscriber]) {
      client.on('ready', () => {
        this.failureLogged = false;
      });
      // ioredis reconnects on its own and emits an error on every attempt.
      // Log the first one per outage.
      client.on('error', (error: Error) => {
        if (this.failureLogged) return;
        this.failureLogged = true;
        this.logger.warn(`Redis connection failed: ${error.message}`);
      });
    }
    this.subscriber.on('message', (channel: string, message: string) =>
      this.deliver(channel, message),
    );
  }

  async publish<Payload>(
    topic: Topic<Payload>,
    payload: Payload,
  ): Promise<void> {
    await this.publisher.publish(
      this.channelOf(topic),
      JSON.stringify(payload),
    );
  }

  async subscribe<Payload>(
    topic: Topic<Payload>,
    filter: (payload: Payload) => boolean = () => true,
  ): Promise<AsyncIterableIterator<Payload>> {
    const channelName = this.channelOf(topic);
    const queue: Payload[] = [];
    const waiting: ((result: IteratorResult<Payload>) => void)[] = [];
    let done = false;

    const listener: Listener = (payload) => {
      const typed = payload as Payload;
      if (!filter(typed)) return;
      const next = waiting.shift();
      if (next) next({ value: typed, done: false });
      else queue.push(typed);
    };
    const stop = () => {
      if (done) return;
      done = true;
      queue.length = 0;
      for (const next of waiting.splice(0)) {
        next({ value: undefined, done: true });
      }
      this.removeListener(channelName, listener);
    };

    await this.addListener(channelName, listener);

    const iterator: AsyncIterableIterator<Payload> = {
      next: () => {
        if (queue.length > 0) {
          return Promise.resolve({
            value: queue.shift() as Payload,
            done: false,
          });
        }
        if (done) return Promise.resolve({ value: undefined, done: true });
        return new Promise((resolve) => waiting.push(resolve));
      },
      return: () => {
        stop();
        return Promise.resolve({ value: undefined, done: true });
      },
      throw: (error?: unknown) => {
        stop();
        return Promise.reject(error);
      },
      [Symbol.asyncIterator]: () => iterator,
    };
    return iterator;
  }

  onModuleDestroy(): void {
    this.channels.clear();
    this.subscriber.disconnect();
    this.publisher.disconnect();
  }

  private channelOf(topic: Topic<unknown>): string {
    return `${this.channelPrefix}${topic.name}`;
  }

  private async addListener(name: string, listener: Listener): Promise<void> {
    let channel = this.channels.get(name);
    if (!channel) {
      const subscribed = this.subscriber.subscribe(name).then(() => undefined);
      channel = { listeners: new Set(), subscribed };
      this.channels.set(name, channel);
      const created = channel;
      subscribed.catch(() => {
        if (this.channels.get(name) === created) this.channels.delete(name);
      });
    }
    channel.listeners.add(listener);
    try {
      await channel.subscribed;
    } catch (error) {
      channel.listeners.delete(listener);
      throw error;
    }
  }

  private removeListener(name: string, listener: Listener): void {
    const channel = this.channels.get(name);
    if (!channel) return;
    channel.listeners.delete(listener);
    if (channel.listeners.size > 0) return;
    this.channels.delete(name);
    this.subscriber.unsubscribe(name).catch(() => undefined);
  }

  private deliver(name: string, message: string): void {
    const channel = this.channels.get(name);
    if (!channel) return;
    let payload: unknown;
    try {
      payload = JSON.parse(message);
    } catch {
      this.logger.warn(`Dropped an event on ${name} that is not JSON`);
      return;
    }
    for (const listener of channel.listeners) listener(payload);
  }
}
