import {
  Client,
  type FetchLike,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
  type OnModuleDestroy,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { upstreamsConfig } from '../../../config/upstreams.config.js';
import { EventBus } from '../../../events/event-bus.js';
import {
  findNetworkRuleError,
  GuardedFetch,
} from '../../../net/guarded-fetch.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { isCredentialsRefusal } from '../auth/credentials-refusal.js';
import { singleFlightRefresh } from '../auth/oauth/single-flight-refresh.js';
import type {
  UpstreamAuth,
  UpstreamAuthTarget,
} from '../auth/upstream-auth.interface.js';
import type { UpstreamAuthProvider } from '../auth/upstream-auth-provider.js';
import { UpstreamAuthProviders } from '../auth/upstream-auth-providers.js';
import { SetupState } from '../connections/connection.interface.js';
import {
  CONNECTION_INCLUDE,
  toConnection,
} from '../connections/connection.mapper.js';
import { ToolSyncService } from '../tool-sync/tool-sync.service.js';
import type { UpstreamTool } from '../tools/tool.interface.js';
import {
  CONNECTION_STATUS_CHANGED,
  ConnectionStatus,
  type ConnectionStatusChanged,
} from './connection-status.interface.js';

export const CONNECT_TIMEOUT_MS = 10_000;
export const LIST_TOOLS_TIMEOUT_MS = 30_000;
const CLIENT_INFO = { name: 'onedoor', version: '0.0.1' };

// One upstream client and what it was opened for. A sync that wants another
// URL or other credentials closes it and opens a new one.
interface Entry {
  // The URL and the provider's fingerprint of the credentials.
  key: string;
  ownerId: string;
  client: Client;
  // Aborts every request of the client, including a connect in progress.
  stop: AbortController;
  // A failed or refused entry stays until the next sync, so its status
  // shows.
  state: 'connecting' | 'connected' | 'failed' | 'refused';
  // Settles when the connect attempt has ended, either way.
  attempt: Promise<void>;
}

// What a sync decided. A wrapper, so the per-connection queue does not wait
// for the connect attempt.
interface Decision {
  attempt?: Promise<void>;
}

// What a connection's row asks for. No client means none is wanted.
interface Target {
  ownerId: string;
  client: {
    key: string;
    url: string;
    provider: UpstreamAuthProvider;
    auth: UpstreamAuthTarget;
  } | null;
}

// Owns one MCP client per enabled and READY connection, for every owner.
// Clients connect in the background: neither startup nor a request waits
// for an upstream server. Every status change is published on the EventBus.
@Injectable()
export class UpstreamRegistryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(UpstreamRegistryService.name);
  private readonly entries = new Map<string, Entry>();
  // The last queued sync per connection. Syncs of one connection decide in
  // the order they were asked for, so the last one sees the latest row.
  private readonly queues = new Map<string, Promise<void>>();
  private closing = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly guardedFetch: GuardedFetch,
    private readonly eventBus: EventBus,
    private readonly toolSync: ToolSyncService,
    private readonly authProviders: UpstreamAuthProviders,
    @Inject(upstreamsConfig.KEY)
    private readonly upstreams: ConfigType<typeof upstreamsConfig>,
  ) {}

  onApplicationBootstrap(): void {
    if (!this.upstreams.connecting) return;
    this.connectAll().catch((error: unknown) =>
      this.logger.warn(`Connecting upstream servers failed: ${String(error)}`),
    );
  }

  async onModuleDestroy(): Promise<void> {
    this.closing = true;
    const entries = [...this.entries.values()];
    this.entries.clear();
    await Promise.all(entries.map((entry) => closeEntry(entry)));
  }

  // The connected client of a connection, or undefined while it connects,
  // after it failed, and when the connection is disabled or not READY.
  client(connectionId: string): Client | undefined {
    const entry = this.entries.get(connectionId);
    return entry?.state === 'connected' ? entry.client : undefined;
  }

  status(connectionId: string): ConnectionStatus {
    switch (this.entries.get(connectionId)?.state) {
      case undefined:
        return ConnectionStatus.OFF;
      case 'connecting':
        return ConnectionStatus.CONNECTING;
      case 'connected':
        return ConnectionStatus.CONNECTED;
      case 'failed':
        return ConnectionStatus.FAILED;
      case 'refused':
        return ConnectionStatus.REFUSED_CREDENTIALS;
    }
  }

  // Every tool the connection's server lists, or null when the connection
  // has no connected client. Throws when the server fails to answer.
  async listTools(connectionId: string): Promise<UpstreamTool[] | null> {
    const client = this.client(connectionId);
    if (!client) return null;
    const { tools } = await client.listTools(undefined, {
      timeout: LIST_TOOLS_TIMEOUT_MS,
    });
    return tools;
  }

  // Status changes of the owner's connections, from now on. A removed
  // connection publishes no change.
  statusChanges(
    ownerId: string,
  ): Promise<AsyncIterableIterator<ConnectionStatusChanged>> {
    return this.eventBus.subscribe(
      CONNECTION_STATUS_CHANGED,
      (event) => event.ownerId === ownerId,
    );
  }

  // Called after a connection is created, changed, enabled, disabled or
  // removed (REQ-CONN-051, REQ-CONN-052).
  syncInBackground(connectionId: string): void {
    if (!this.upstreams.connecting) return;
    this.sync(connectionId).catch((error: unknown) =>
      this.logger.warn(
        `Upstream sync failed for connection ${connectionId}: ${String(error)}`,
      ),
    );
  }

  // Brings the connection's client in line with its row: opens one when the
  // connection should have one, reopens it when the URL or the credentials
  // changed, and closes it otherwise. Resolves when the connect attempt, if any, has ended.
  async sync(connectionId: string): Promise<void> {
    const previous = this.queues.get(connectionId) ?? Promise.resolve();
    const decision = previous.then(() => this.decide(connectionId));
    const queued = decision.then(
      () => undefined,
      () => undefined,
    );
    this.queues.set(connectionId, queued);
    void queued.then(() => {
      if (this.queues.get(connectionId) === queued) {
        this.queues.delete(connectionId);
      }
    });
    const { attempt } = await decision;
    await attempt;
  }

  private async connectAll(): Promise<void> {
    const rows = await this.prisma.connection.findMany({
      where: { enabled: true },
      select: { id: true },
    });
    for (const { id } of rows) this.syncInBackground(id);
  }

  private async decide(connectionId: string): Promise<Decision> {
    if (this.closing) return {};
    const target = await this.target(connectionId);
    const current = this.entries.get(connectionId);
    // A failed or refused client is retried by the next sync.
    const settled = current?.state === 'failed' || current?.state === 'refused';
    if (current && !settled && current.key === target?.client?.key) {
      return { attempt: current.attempt };
    }
    if (current) {
      this.entries.delete(connectionId);
      await closeEntry(current);
      this.logger.log(`Closed upstream client for connection ${connectionId}`);
    }
    if (target === null || this.closing) return {};
    if (target.client === null) {
      if (current) this.changed(connectionId, target.ownerId);
      return {};
    }
    return { attempt: this.open(connectionId, target.ownerId, target.client) };
  }

  // What the connection's row asks for, or null when the row is gone. An
  // enabled, READY connection gets a client when a provider exists for its
  // auth type (NONE, API_KEY and OAUTH_DCR).
  private async target(connectionId: string): Promise<Target | null> {
    const row = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: CONNECTION_INCLUDE,
    });
    if (!row) return null;
    const connection = toConnection(row);
    const provider = this.authProviders.for(connection.authType);
    if (
      !connection.enabled ||
      connection.setupState !== SetupState.READY ||
      !provider
    ) {
      return { ownerId: row.ownerId, client: null };
    }
    const auth: UpstreamAuthTarget = {
      connectionId,
      ownerId: row.ownerId,
      authType: connection.authType,
      headerName: connection.headerName,
      headerPrefix: connection.headerPrefix,
      apiKey:
        row.apiKeyCiphertext && row.apiKeyKeyId
          ? { ciphertext: row.apiKeyCiphertext, keyId: row.apiKeyKeyId }
          : null,
      oauthAuthorizedAt: row.oauth?.authorizedAt ?? null,
    };
    return {
      ownerId: row.ownerId,
      client: {
        key: JSON.stringify([connection.url, provider.fingerprint(auth)]),
        url: connection.url,
        provider,
        auth,
      },
    };
  }

  private open(
    connectionId: string,
    ownerId: string,
    target: NonNullable<Target['client']>,
  ): Promise<void> {
    const stop = new AbortController();
    // A server that announces a changed tool list gets its tools synced.
    // Servers on the 2026-07-28 protocol send no unsolicited notifications,
    // so for them a sync runs on connect and on the re-sync action only.
    const client = new Client(CLIENT_INFO, {
      listChanged: {
        tools: {
          autoRefresh: false,
          onChanged: () => this.toolSync.syncInBackground(connectionId),
        },
      },
    });
    const entry: Entry = {
      key: target.key,
      ownerId,
      client,
      stop,
      state: 'connecting',
      attempt: Promise.resolve(),
    };
    this.entries.set(connectionId, entry);
    this.changed(connectionId, ownerId);
    entry.attempt = this.connect(connectionId, entry, target);
    return entry.attempt;
  }

  private async connect(
    connectionId: string,
    entry: Entry,
    target: NonNullable<Target['client']>,
  ): Promise<void> {
    try {
      // The decrypted credentials live only in this transport's options.
      // A provider that loses the credentials (a refused OAuth refresh) asks
      // for a sync, which sees the connection needs its owner again.
      const auth = await target.provider.authenticate(target.auth, {
        credentialsLost: () => this.syncInBackground(connectionId),
      });
      const transport = new StreamableHTTPClientTransport(new URL(target.url), {
        fetch: stoppable(this.clientFetch(auth), entry.stop.signal),
        requestInit: { headers: auth.headers },
        authProvider: auth.authProvider,
      });
      await entry.client.connect(transport, {
        signal: entry.stop.signal,
        timeout: CONNECT_TIMEOUT_MS,
      });
    } catch (error) {
      // A client closed while it connected was replaced or is no longer
      // wanted, so its failure is not news.
      if (this.entries.get(connectionId) !== entry) return;
      await closeEntry(entry);
      entry.state = isCredentialsRefusal(error) ? 'refused' : 'failed';
      this.changed(connectionId, entry.ownerId);
      this.logger.warn(
        `Could not connect to the upstream server of connection ${connectionId}: ${failureReason(error)}`,
      );
      return;
    }
    if (this.entries.get(connectionId) !== entry) {
      await closeEntry(entry);
      return;
    }
    entry.state = 'connected';
    this.changed(connectionId, entry.ownerId);
    this.toolSync.syncInBackground(connectionId);
    this.logger.log(`Connected upstream client for connection ${connectionId}`);
  }

  // The fetch of one client. An OAuth client also refreshes its tokens
  // through it: those bodies carry secrets and stay on their origin, and
  // concurrent refreshes share one request.
  private clientFetch(auth: UpstreamAuth): FetchLike {
    const fetch = this.guardedFetch.create({
      sensitiveHeaders: auth.sensitiveHeaders,
      bodyStaysOnOrigin: auth.authProvider !== undefined,
    });
    return auth.authProvider ? singleFlightRefresh(fetch) : fetch;
  }

  // Publishes in the background: a status change never waits for Redis.
  private changed(connectionId: string, ownerId: string): void {
    if (this.closing) return;
    this.eventBus
      .publish(CONNECTION_STATUS_CHANGED, { connectionId, ownerId })
      .catch((error: unknown) =>
        this.logger.warn(
          `Could not publish the status of connection ${connectionId}: ${String(error)}`,
        ),
      );
  }
}

// Every request of the transport also stops when `stop` aborts.
function stoppable(fetch: FetchLike, stop: AbortSignal): FetchLike {
  return (url, init) =>
    fetch(url, {
      ...init,
      signal: init?.signal ? AbortSignal.any([init.signal, stop]) : stop,
    });
}

async function closeEntry(entry: Entry): Promise<void> {
  entry.stop.abort();
  await entry.client.close().catch(() => undefined);
}

// Fixed text for the log: an upstream's own error text is not repeated.
function failureReason(error: unknown): string {
  const rule = findNetworkRuleError(error);
  if (rule) return `the network rules stopped the request: ${rule.message}`;
  if (isCredentialsRefusal(error)) return 'the server refused the credentials';
  return error instanceof Error ? error.name : 'unknown error';
}
