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
import { AuthType } from '../../../generated/prisma/enums.js';
import {
  findNetworkRuleError,
  GuardedFetch,
} from '../../../net/guarded-fetch.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { SetupState } from '../connections/connection.interface.js';
import {
  CONNECTION_INCLUDE,
  toConnection,
} from '../connections/connection.mapper.js';

export const CONNECT_TIMEOUT_MS = 10_000;
const CLIENT_INFO = { name: 'onedoor', version: '0.0.1' };

// One upstream client and what it was opened for. A sync that wants another
// URL closes it and opens a new one.
interface Entry {
  url: string;
  client: Client;
  // Aborts every request of the client, including a connect in progress.
  stop: AbortController;
  connected: boolean;
  // Settles when the connect attempt has ended, either way.
  attempt: Promise<void>;
}

// What a sync decided. A wrapper, so the per-connection queue does not wait
// for the connect attempt.
interface Decision {
  attempt?: Promise<void>;
}

// Owns one MCP client per enabled and READY connection, for every owner.
// Clients connect in the background: neither startup nor a request waits
// for an upstream server.
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
    return entry?.connected ? entry.client : undefined;
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
  // connection should have one, reopens it when the URL changed, and closes
  // it otherwise. Resolves when the connect attempt, if any, has ended.
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
    const url = await this.wantedUrl(connectionId);
    const current = this.entries.get(connectionId);
    if (current && current.url === url) return { attempt: current.attempt };
    if (current) {
      this.entries.delete(connectionId);
      await closeEntry(current);
      this.logger.log(`Closed upstream client for connection ${connectionId}`);
    }
    if (url === null || this.closing) return {};
    return { attempt: this.open(connectionId, url) };
  }

  // The URL the connection's client should use, or null when it should have
  // none. Connections that need credentials wait for UpstreamAuthProvider;
  // until then only NONE connections get a client.
  private async wantedUrl(connectionId: string): Promise<string | null> {
    const row = await this.prisma.connection.findUnique({
      where: { id: connectionId },
      include: CONNECTION_INCLUDE,
    });
    if (!row) return null;
    const connection = toConnection(row);
    if (!connection.enabled) return null;
    if (connection.setupState !== SetupState.READY) return null;
    if (connection.authType !== AuthType.NONE) return null;
    return connection.url;
  }

  private open(connectionId: string, url: string): Promise<void> {
    const stop = new AbortController();
    const client = new Client(CLIENT_INFO);
    const transport = new StreamableHTTPClientTransport(new URL(url), {
      fetch: stoppable(this.guardedFetch.create(), stop.signal),
    });
    const entry: Entry = {
      url,
      client,
      stop,
      connected: false,
      attempt: Promise.resolve(),
    };
    entry.attempt = this.connect(connectionId, entry, transport);
    this.entries.set(connectionId, entry);
    return entry.attempt;
  }

  private async connect(
    connectionId: string,
    entry: Entry,
    transport: StreamableHTTPClientTransport,
  ): Promise<void> {
    try {
      await entry.client.connect(transport, {
        signal: entry.stop.signal,
        timeout: CONNECT_TIMEOUT_MS,
      });
    } catch (error) {
      // A client closed while it connected was replaced or is no longer
      // wanted, so its failure is not news.
      if (this.entries.get(connectionId) !== entry) return;
      this.entries.delete(connectionId);
      await closeEntry(entry);
      this.logger.warn(
        `Could not connect to the upstream server of connection ${connectionId}: ${failureReason(error)}`,
      );
      return;
    }
    if (this.entries.get(connectionId) !== entry) {
      await closeEntry(entry);
      return;
    }
    entry.connected = true;
    this.logger.log(`Connected upstream client for connection ${connectionId}`);
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
  entry.connected = false;
  entry.stop.abort();
  await entry.client.close().catch(() => undefined);
}

// Fixed text for the log: an upstream's own error text is not repeated.
function failureReason(error: unknown): string {
  const rule = findNetworkRuleError(error);
  if (rule) return `the network rules stopped the request: ${rule.message}`;
  return error instanceof Error ? error.name : 'unknown error';
}
