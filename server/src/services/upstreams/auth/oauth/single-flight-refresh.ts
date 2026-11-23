import type { FetchLike } from '@modelcontextprotocol/client';

// How long the answer to a refresh is kept for requests that still hold the
// refresh token it used.
const KEEP_MS = 60_000;

// Requests that get a 401 at the same time each refresh the token. Servers
// that rotate refresh tokens accept the old one only once, so the second
// refresh would fail and the tokens would be lost. This fetch sends one
// refresh per refresh token and gives every caller a copy of its answer.
export function singleFlightRefresh(fetch: FetchLike): FetchLike {
  const answers = new Map<string, Promise<Response>>();
  return (url, init) => {
    const body = init?.body;
    if (
      init?.method !== 'POST' ||
      !(body instanceof URLSearchParams) ||
      body.get('grant_type') !== 'refresh_token'
    ) {
      return fetch(url, init);
    }
    const key = `${String(url)}\n${body.get('refresh_token') ?? ''}`;
    let answer = answers.get(key);
    if (!answer) {
      answer = fetch(url, init);
      answers.set(key, answer);
      const forget = () => {
        setTimeout(() => answers.delete(key), KEEP_MS).unref();
      };
      answer.then(forget, () => answers.delete(key));
    }
    return answer.then((response) => response.clone());
  };
}
