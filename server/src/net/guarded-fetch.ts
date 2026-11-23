import { promises as dns, type LookupAddress } from 'node:dns';
import { isIP, type LookupFunction } from 'node:net';
import type { FetchLike } from '@modelcontextprotocol/client';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Agent, fetch as undiciFetch } from 'undici';
import { addressProblem, allowsLoopback } from './address-policy.js';
import { fetchUrlProblem } from './url-policy.js';

export const MAX_REDIRECTS = 3;
export const MAX_RESPONSE_BYTES = 1024 * 1024;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const NULL_BODY_STATUSES = new Set([101, 204, 205, 304]);
const CREDENTIAL_HEADERS = ['authorization', 'cookie', 'proxy-authorization'];

// A request the network rules refused. The message names the rule and the
// host, never a header value.
export class NetworkRuleError extends Error {
  override readonly name = 'NetworkRuleError';
}

// fetch wraps errors from the connection in a TypeError; this finds ours.
export function findNetworkRuleError(error: unknown): NetworkRuleError | null {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e instanceof NetworkRuleError) return e;
  }
  return null;
}

export class ResponseTooLargeError extends Error {
  override readonly name = 'ResponseTooLargeError';
}

export interface GuardedFetchOptions {
  // Header names to drop when a redirect leaves the origin, besides the
  // standard credential headers. For example an API key's header name.
  sensitiveHeaders?: readonly string[];
  // Refuse a redirect that would send the request body to another origin
  // (307 or 308). For bodies that carry secrets, such as OAuth token
  // requests with a code, a code verifier or a refresh token.
  bodyStaysOnOrigin?: boolean;
}

// Resolves every address of a host name.
export type ResolveAll = (
  hostname: string,
  family?: number,
) => Promise<LookupAddress[]>;

const resolveWithDns: ResolveAll = (hostname, family) =>
  dns.lookup(hostname, { all: true, family: family ?? 0 });

// Fetches URLs that users and upstream servers supply, under REQ-CONN-063:
// https (or http for localhost), public addresses only, checked when the
// connection opens so DNS cannot point a checked name elsewhere, at most
// three redirects, each checked again, and at most 1 MB of response body.
@Injectable()
export class GuardedFetch implements OnModuleDestroy {
  private readonly agent: Agent;

  // `resolve` replaces DNS in tests.
  constructor(resolve: ResolveAll = resolveWithDns) {
    this.agent = new Agent({ connect: { lookup: checkedLookup(resolve) } });
  }

  // A fetch for one purpose, such as one MCP transport.
  create(options: GuardedFetchOptions = {}): FetchLike {
    const sensitive = [
      ...CREDENTIAL_HEADERS,
      ...(options.sensitiveHeaders ?? []).map((name) => name.toLowerCase()),
    ];
    const bodyStaysOnOrigin = options.bodyStaysOnOrigin ?? false;
    return (input, init) =>
      this.fetch(new URL(String(input)), init, sensitive, bodyStaysOnOrigin);
  }

  async onModuleDestroy(): Promise<void> {
    await this.agent.close();
  }

  private async fetch(
    start: URL,
    init: RequestInit = {},
    sensitiveHeaders: readonly string[],
    bodyStaysOnOrigin: boolean,
  ): Promise<Response> {
    const headers = new Headers(init.headers);
    // A body is kept as a string, so a redirect can send it again. A form
    // (OAuth token requests) becomes its URL-encoded text.
    let body: string | undefined;
    if (init.body instanceof URLSearchParams) {
      body = init.body.toString();
      if (!headers.has('content-type')) {
        headers.set(
          'content-type',
          'application/x-www-form-urlencoded;charset=UTF-8',
        );
      }
    } else if (typeof init.body === 'string') {
      body = init.body;
    } else if (init.body !== undefined && init.body !== null) {
      throw new TypeError('GuardedFetch sends only string and form bodies');
    }
    let url = start;
    let method = init.method ?? 'GET';

    for (let redirects = 0; ; redirects++) {
      assertUrlAllowed(url);
      const response = await undiciFetch(url, {
        method,
        body,
        headers: Object.fromEntries(headers),
        signal: init.signal ?? undefined,
        redirect: 'manual',
        dispatcher: this.agent,
      });

      const location = response.headers.get('location');
      if (!REDIRECT_STATUSES.has(response.status) || location === null) {
        return toCappedResponse(response);
      }
      await response.body?.cancel();
      if (redirects === MAX_REDIRECTS) {
        throw new NetworkRuleError(
          `More than ${MAX_REDIRECTS} redirects from ${start.host}`,
        );
      }

      const next = new URL(location, url);
      if (
        response.status === 303 ||
        ((response.status === 301 || response.status === 302) &&
          method === 'POST')
      ) {
        method = 'GET';
        body = undefined;
        headers.delete('content-type');
      }
      if (next.origin !== url.origin) {
        for (const name of sensitiveHeaders) headers.delete(name);
        if (bodyStaysOnOrigin && body !== undefined) {
          throw new NetworkRuleError(
            `${url.host} redirected a request body to ${next.host}`,
          );
        }
      }
      url = next;
    }
  }
}

function assertUrlAllowed(url: URL): void {
  const problem = fetchUrlProblem(url.href);
  if (problem) throw new NetworkRuleError(problem);
  // Literal IP hosts skip DNS, so the agent's lookup never sees them.
  const host = url.hostname.replace(/^\[|\]$/g, '');
  if (isIP(host) !== 0) {
    const refused = addressProblem(host, allowsLoopback(url.hostname));
    if (refused) throw new NetworkRuleError(`${url.host} is ${refused}`);
  }
}

// Resolves every address of a host and refuses the connection when any of
// them is not allowed.
function checkedLookup(resolve: ResolveAll): LookupFunction {
  return (hostname, options, callback) => {
    const family = typeof options.family === 'number' ? options.family : 0;
    resolve(hostname, family).then(
      (list) => {
        const loopback = allowsLoopback(hostname);
        const refused = list
          .map((entry) => addressProblem(entry.address, loopback))
          .find((problem) => problem !== null);
        if (list.length === 0 || refused) {
          callback(
            new NetworkRuleError(
              `${hostname} resolves to ${refused ?? 'no address'}`,
            ),
            '',
            0,
          );
          return;
        }
        if (options.all) {
          callback(null, list);
          return;
        }
        const [first] = list;
        callback(null, first?.address ?? '', first?.family ?? 0);
      },
      (error: NodeJS.ErrnoException) => callback(error, '', 0),
    );
  };
}

function toCappedResponse(
  response: Awaited<ReturnType<typeof undiciFetch>>,
): Response {
  const init = {
    status: response.status,
    statusText: response.statusText,
    headers: new Headers([...response.headers]),
  };
  if (NULL_BODY_STATUSES.has(response.status) || response.body === null) {
    return new Response(null, init);
  }
  const reader = response.body.getReader();
  let total = 0;
  const capped = new ReadableStream<Uint8Array>({
    async pull(controller) {
      const { done, value } = await reader.read();
      if (done) {
        controller.close();
        return;
      }
      total += value?.byteLength ?? 0;
      if (total > MAX_RESPONSE_BYTES) {
        await reader.cancel();
        controller.error(
          new ResponseTooLargeError(
            `The response is larger than ${MAX_RESPONSE_BYTES} bytes`,
          ),
        );
        return;
      }
      if (value) controller.enqueue(value);
    },
    cancel(reason) {
      return reader.cancel(reason);
    },
  });
  return new Response(capped, init);
}
