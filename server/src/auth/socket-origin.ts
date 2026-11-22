const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]']);

// Browsers apply no CORS to WebSockets, so any page could open a socket to
// OneDoor and read its subscriptions. A socket from a browser is accepted
// only when the page is served from this machine. A client that is not a
// browser sends no Origin and is accepted, as plain HTTP requests are.
export function isAllowedSocketOrigin(origin: string | undefined): boolean {
  if (origin === undefined) return true;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return false;
  return LOCAL_HOSTS.has(url.hostname);
}
