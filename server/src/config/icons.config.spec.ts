import { iconsConfig } from './icons.config.js';

describe('iconsConfig', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('fetches icons by default', () => {
    vi.stubEnv('ICON_FETCHING', undefined);
    expect(iconsConfig()).toEqual({ fetching: true });
  });

  it.each([
    ['false', false],
    ['0', false],
    ['true', true],
  ])('reads ICON_FETCHING=%s', (value, fetching) => {
    vi.stubEnv('ICON_FETCHING', value);
    expect(iconsConfig().fetching).toBe(fetching);
  });

  it('rejects a value that is not a boolean', () => {
    vi.stubEnv('ICON_FETCHING', 'sometimes');
    expect(() => iconsConfig()).toThrow();
  });
});
