import { addressProblem, allowsLoopback } from './address-policy.js';

describe('addressProblem (REQ-CONN-063)', () => {
  it.each(['140.82.112.21', '104.16.0.1', '2606:4700::6810:1'])(
    'allows the public address %s',
    (address) => {
      expect(addressProblem(address, false)).toBeNull();
    },
  );

  it.each([
    ['cloud metadata', '169.254.169.254'],
    ['private 10/8', '10.0.0.5'],
    ['private 172.16/12', '172.20.1.1'],
    ['private 192.168/16', '192.168.1.10'],
    ['carrier-grade NAT', '100.64.0.1'],
    ['this network', '0.0.0.0'],
    ['loopback', '127.0.0.1'],
    ['IPv6 loopback', '::1'],
    ['IPv6 unique local', 'fd00:ec2::254'],
    ['IPv6 link-local', 'fe80::1'],
    ['IPv4-mapped private', '::ffff:10.0.0.5'],
    ['IPv4-mapped metadata', '::ffff:169.254.169.254'],
    ['multicast', '224.0.0.1'],
  ])('refuses %s (%s)', (_name, address) => {
    expect(addressProblem(address, false)).toEqual(expect.any(String));
  });

  it('allows loopback only when the URL names a loopback host', () => {
    expect(addressProblem('127.0.0.1', true)).toBeNull();
    expect(addressProblem('::1', true)).toBeNull();
    expect(addressProblem('10.0.0.5', true)).toEqual(expect.any(String));
  });

  it('allows loopback for localhost and 127.0.0.1 only', () => {
    expect(allowsLoopback('localhost')).toBe(true);
    expect(allowsLoopback('127.0.0.1')).toBe(true);
    expect(allowsLoopback('localhost.example.com')).toBe(false);
    expect(allowsLoopback('127.0.0.2')).toBe(false);
  });
});
