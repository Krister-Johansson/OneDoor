import { singleFlightRefresh } from './single-flight-refresh.js';

const TOKEN_URL = 'https://auth.example.test/token';

function refresh(token: string) {
  return {
    method: 'POST',
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: token,
    }),
  };
}

describe('singleFlightRefresh (T21)', () => {
  it('sends one refresh per refresh token and gives every caller the answer', async () => {
    let calls = 0;
    const fetch = singleFlightRefresh(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return new Response(JSON.stringify({ access_token: `a${calls}` }));
    });

    const answers = await Promise.all([
      fetch(TOKEN_URL, refresh('r1')),
      fetch(TOKEN_URL, refresh('r1')),
    ]);
    expect(calls).toBe(1);
    for (const answer of answers) {
      await expect(answer.json()).resolves.toEqual({ access_token: 'a1' });
    }
    // A caller that still holds the used token after the answer came.
    await expect(
      (await fetch(TOKEN_URL, refresh('r1'))).json(),
    ).resolves.toEqual({ access_token: 'a1' });
    expect(calls).toBe(1);

    await fetch(TOKEN_URL, refresh('r2'));
    expect(calls).toBe(2);
  });

  it('passes other requests through unchanged', async () => {
    let calls = 0;
    const fetch = singleFlightRefresh(async () => {
      calls += 1;
      return new Response('ok');
    });
    const code = {
      method: 'POST',
      body: new URLSearchParams({ grant_type: 'authorization_code' }),
    };
    await fetch(TOKEN_URL, code);
    await fetch(TOKEN_URL, code);
    await fetch('https://mcp.example.test/mcp', { method: 'POST', body: '{}' });
    expect(calls).toBe(3);
  });

  it('tries again after a refresh that failed to send', async () => {
    let calls = 0;
    const fetch = singleFlightRefresh(async () => {
      calls += 1;
      if (calls === 1) throw new TypeError('fetch failed');
      return new Response('{}');
    });
    await expect(fetch(TOKEN_URL, refresh('r1'))).rejects.toThrow();
    await fetch(TOKEN_URL, refresh('r1'));
    expect(calls).toBe(2);
  });
});
