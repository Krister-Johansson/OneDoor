import { isAllowedSocketOrigin } from './socket-origin.js';

describe('isAllowedSocketOrigin', () => {
  it('accepts a client without an Origin header', () => {
    expect(isAllowedSocketOrigin(undefined)).toBe(true);
  });

  it.each([
    'http://localhost:3001',
    'http://127.0.0.1:3101',
    'https://localhost',
    'http://[::1]:3001',
  ])('accepts a page served from this machine: %s', (origin) => {
    expect(isAllowedSocketOrigin(origin)).toBe(true);
  });

  it.each([
    'https://evil.example',
    'http://localhost.evil.example',
    'http://127.0.0.1.nip.io',
    'null',
    'file://',
    'chrome-extension://abc',
  ])('refuses %s', (origin) => {
    expect(isAllowedSocketOrigin(origin)).toBe(false);
  });
});
