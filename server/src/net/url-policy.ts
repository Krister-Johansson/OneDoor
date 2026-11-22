// REQ-CONN-022 and REQ-CONN-063: https, or http only for localhost and
// 127.0.0.1; no credentials in the URL. Returns the problem as text, or
// null. The message never repeats the URL, which may hold a password.

const LOCAL_HTTP_HOSTS = new Set(['localhost', '127.0.0.1']);
export const MAX_URL_LENGTH = 2048;

export function fetchUrlProblem(value: string): string | null {
  if (value.length > MAX_URL_LENGTH) {
    return `url must be at most ${MAX_URL_LENGTH} characters`;
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return 'url must be an absolute URL';
  }
  if (url.username !== '' || url.password !== '') {
    return 'url must not contain a user name or password';
  }
  if (url.protocol === 'https:') return null;
  if (url.protocol === 'http:' && LOCAL_HTTP_HOSTS.has(url.hostname)) {
    return null;
  }
  return 'url must use https, or http only for localhost and 127.0.0.1';
}
