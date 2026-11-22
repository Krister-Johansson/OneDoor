import { eventsConfig } from './events.config.js';

describe('eventsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses Redis by default', () => {
    vi.stubEnv('EVENT_BUS', undefined);
    expect(eventsConfig()).toEqual({ eventBus: 'redis' });
  });

  it('reads EVENT_BUS', () => {
    vi.stubEnv('EVENT_BUS', 'redis');
    expect(eventsConfig().eventBus).toBe('redis');
  });

  it('rejects an unknown event bus', () => {
    vi.stubEnv('EVENT_BUS', 'kafka');
    expect(() => eventsConfig()).toThrow();
  });
});
