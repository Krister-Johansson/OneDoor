import { BlockList, isIP } from 'node:net';

// REQ-CONN-063: OneDoor fetches only public addresses. Loopback is allowed
// only when the URL itself names localhost or 127.0.0.1, so the test twins
// and local servers work.

const blocked = new BlockList();
// IPv4: "this network", private, carrier-grade NAT, loopback, link-local
// (including cloud metadata at 169.254.169.254), IETF protocol assignments,
// documentation, benchmarking, multicast and reserved.
for (const [prefix, bits] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(prefix, bits, 'ipv4');
}
// IPv6: unspecified, loopback, IPv4-mapped (checked again as IPv4 below),
// NAT64, discard, documentation, unique local (including fd00:ec2::254, a
// cloud metadata address), link-local and multicast.
for (const [prefix, bits] of [
  ['::', 128],
  ['::1', 128],
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(prefix, bits, 'ipv6');
}

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1']);

// True when the URL names a host that may use loopback addresses.
export function allowsLoopback(hostname: string): boolean {
  return LOOPBACK_HOSTS.has(hostname);
}

function isLoopback(address: string): boolean {
  return address === '::1' || address.startsWith('127.');
}

// Returns why an address may not be fetched, or null when it may.
export function addressProblem(
  address: string,
  loopbackAllowed: boolean,
): string | null {
  const family = isIP(address);
  if (family === 0) return 'not an IP address';
  if (loopbackAllowed && isLoopback(address)) return null;

  // An IPv4-mapped IPv6 address (::ffff:10.0.0.5) is judged as its IPv4 address.
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(address)?.[1];
  if (mapped) return addressProblem(mapped, loopbackAllowed);

  return blocked.check(address, family === 4 ? 'ipv4' : 'ipv6')
    ? 'a private, loopback, link-local or reserved address'
    : null;
}
