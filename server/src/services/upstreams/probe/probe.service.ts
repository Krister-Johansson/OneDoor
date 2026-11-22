import {
  Client,
  discoverOAuthServerInfo,
  extractResourceMetadataUrl,
  type FetchLike,
  SdkHttpError,
  StreamableHTTPClientTransport,
  UnauthorizedError,
} from '@modelcontextprotocol/client';
import { Injectable } from '@nestjs/common';
import type { CheckCredentialsInput } from '../../../api/graphql/probe/inputs/check-credentials.input.js';
import {
  type CredentialsCheckModel,
  CredentialsStatus,
} from '../../../api/graphql/probe/models/credentials-check.model.js';
import {
  type ProbeResultModel,
  ProbeStatus,
} from '../../../api/graphql/probe/models/probe-result.model.js';
import { ValidationError } from '../../../errors/domain-errors.js';
import { AuthType } from '../../../generated/prisma/enums.js';
import {
  findNetworkRuleError,
  GuardedFetch,
} from '../../../net/guarded-fetch.js';
import { fetchUrlProblem } from '../../../net/url-policy.js';
import {
  DEFAULT_HEADER_NAME,
  DEFAULT_HEADER_PREFIX,
} from '../connections/connection-rules.js';

export const PROBE_TIMEOUT_MS = 10_000;
const CLIENT_INFO = { name: 'onedoor', version: '0.0.1' };
const TOOL_NAMES_SHOWN = 5;

// How a failed connection attempt ended. Messages are fixed text: an
// upstream's own error text never reaches the user, so it cannot carry a
// secret back.
type Failure =
  | { kind: 'refused'; message: string }
  | { kind: 'auth' }
  | { kind: 'unreachable'; message: string }
  | { kind: 'not-mcp' };

// A guarded fetch that stops at the deadline and remembers the last 401.
interface ProbeFetch {
  fetch: FetchLike;
  lastChallenge(): URL | undefined;
}

@Injectable()
export class ProbeService {
  constructor(private readonly guardedFetch: GuardedFetch) {}

  // REQ-CONN-060 and REQ-CONN-061. Stores nothing.
  async probe(url: string): Promise<ProbeResultModel> {
    assertUrl(url);
    const deadline = AbortSignal.timeout(PROBE_TIMEOUT_MS);
    const probeFetch = this.probeFetch(deadline);
    const client = new Client(CLIENT_INFO);
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(url), {
          fetch: probeFetch.fetch,
        }),
      );
      const info = client.getServerVersion();
      return {
        ...emptyProbe(),
        status: ProbeStatus.MCP_SERVER,
        message: 'The server answered as an MCP server without credentials.',
        suggestedAuthType: AuthType.NONE,
        serverName: info?.name ?? null,
        serverTitle: info?.title ?? null,
        serverVersion: info?.version ?? null,
        serverDescription: info?.description ?? null,
        iconUrls: (info?.icons ?? [])
          .map((icon) => icon.src)
          .filter((src) => /^https?:\/\//.test(src) && src.length <= 2048),
      };
    } catch (error) {
      const failure = classify(error, deadline, probeFetch.lastChallenge());
      switch (failure.kind) {
        case 'auth':
          return this.authRequired(url, probeFetch);
        case 'refused':
          return {
            ...emptyProbe(),
            status: ProbeStatus.REFUSED,
            message: failure.message,
          };
        case 'unreachable':
          return {
            ...emptyProbe(),
            status: ProbeStatus.UNREACHABLE,
            message: failure.message,
          };
        case 'not-mcp':
          return {
            ...emptyProbe(),
            status: ProbeStatus.NOT_MCP,
            message: 'The server answered, but not as an MCP server.',
          };
      }
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  // REQ-CONN-062. Connects with the entered credentials, lists the tools,
  // and stores nothing.
  async checkCredentials(
    input: CheckCredentialsInput,
  ): Promise<CredentialsCheckModel> {
    assertUrl(input.url);
    const headers: Record<string, string> = {};
    let sensitiveHeaders: string[] = [];
    if (input.authType === AuthType.API_KEY) {
      if (!input.apiKey) {
        throw new ValidationError('apiKey is required for API_KEY');
      }
      const name = input.headerName ?? DEFAULT_HEADER_NAME;
      const prefix = input.headerPrefix ?? DEFAULT_HEADER_PREFIX;
      headers[name] =
        prefix === '' ? input.apiKey : `${prefix} ${input.apiKey}`;
      sensitiveHeaders = [name];
    } else if (input.apiKey || input.headerName || input.headerPrefix) {
      throw new ValidationError(
        'apiKey, headerName and headerPrefix are only for API_KEY',
      );
    }

    const deadline = AbortSignal.timeout(PROBE_TIMEOUT_MS);
    const probeFetch = this.probeFetch(deadline, sensitiveHeaders);
    const client = new Client(CLIENT_INFO);
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(input.url), {
          fetch: probeFetch.fetch,
          requestInit: { headers },
        }),
      );
      const { tools } = await client.listTools();
      return {
        status: CredentialsStatus.OK,
        message: `Connected. The server has ${tools.length} tools.`,
        toolCount: tools.length,
        toolNames: tools.slice(0, TOOL_NAMES_SHOWN).map((tool) => tool.name),
      };
    } catch (error) {
      const failure = classify(error, deadline, probeFetch.lastChallenge());
      const result = { toolCount: null, toolNames: [] };
      switch (failure.kind) {
        case 'auth':
          return {
            ...result,
            status: CredentialsStatus.REFUSED_CREDENTIALS,
            message: 'The server refused the credentials.',
          };
        case 'refused':
          return {
            ...result,
            status: CredentialsStatus.REFUSED,
            message: failure.message,
          };
        case 'unreachable':
          return {
            ...result,
            status: CredentialsStatus.UNREACHABLE,
            message: failure.message,
          };
        case 'not-mcp':
          return {
            ...result,
            status: CredentialsStatus.NOT_MCP,
            message: 'The server answered, but not as an MCP server.',
          };
      }
    } finally {
      await client.close().catch(() => undefined);
    }
  }

  // The server needs credentials. Its OAuth metadata, if any, says whether
  // OneDoor can register itself (REQ-CONN-060).
  private async authRequired(
    url: string,
    probeFetch: ProbeFetch,
  ): Promise<ProbeResultModel> {
    let oauth = false;
    let oauthDcr = false;
    try {
      const info = await discoverOAuthServerInfo(url, {
        resourceMetadataUrl: probeFetch.lastChallenge(),
        fetchFn: probeFetch.fetch,
      });
      oauth = info.authorizationServerMetadata !== undefined;
      oauthDcr = Boolean(
        info.authorizationServerMetadata?.registration_endpoint,
      );
    } catch {
      // No usable OAuth metadata: the server takes another kind of credential.
    }
    return {
      ...emptyProbe(),
      status: ProbeStatus.AUTH_REQUIRED,
      message: oauthDcr
        ? 'The server needs authorization and supports OAuth with dynamic client registration.'
        : 'The server needs credentials.',
      authRequired: true,
      oauth,
      oauthDcr,
      suggestedAuthType: oauthDcr ? AuthType.OAUTH_DCR : AuthType.API_KEY,
    };
  }

  private probeFetch(
    deadline: AbortSignal,
    sensitiveHeaders: string[] = [],
  ): ProbeFetch {
    const guarded = this.guardedFetch.create({ sensitiveHeaders });
    let challenge: URL | undefined;
    return {
      fetch: async (url, init) => {
        const signal = init?.signal
          ? AbortSignal.any([init.signal, deadline])
          : deadline;
        const response = await guarded(url, { ...init, signal });
        if (response.status === 401) {
          challenge = extractResourceMetadataUrl(response) ?? challenge;
        }
        return response;
      },
      lastChallenge: () => challenge,
    };
  }
}

function assertUrl(url: string): void {
  const problem = fetchUrlProblem(url);
  if (problem) throw new ValidationError(problem);
}

function emptyProbe(): ProbeResultModel {
  return {
    status: ProbeStatus.NOT_MCP,
    message: '',
    authRequired: false,
    oauth: false,
    oauthDcr: false,
    suggestedAuthType: null,
    serverName: null,
    serverTitle: null,
    serverVersion: null,
    serverDescription: null,
    iconUrls: [],
  };
}

function classify(
  error: unknown,
  deadline: AbortSignal,
  challenge: URL | undefined,
): Failure {
  const rule = findNetworkRuleError(error);
  if (rule) {
    return {
      kind: 'refused',
      message: `The network rules stopped the request: ${rule.message}.`,
    };
  }
  if (
    error instanceof UnauthorizedError ||
    (error instanceof SdkHttpError &&
      (error.status === 401 || error.status === 403)) ||
    challenge !== undefined
  ) {
    return { kind: 'auth' };
  }
  if (deadline.aborted) {
    return {
      kind: 'unreachable',
      message: `The server did not answer within ${PROBE_TIMEOUT_MS / 1000} seconds.`,
    };
  }
  if (isConnectionFailure(error)) {
    return { kind: 'unreachable', message: 'The server could not be reached.' };
  }
  return { kind: 'not-mcp' };
}

// fetch reports a failed connection (DNS, refused, reset) as a TypeError.
function isConnectionFailure(error: unknown): boolean {
  for (let e = error; e instanceof Error; e = e.cause) {
    if (e instanceof TypeError && e.message === 'fetch failed') return true;
  }
  return false;
}
