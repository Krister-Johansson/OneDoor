import { BullRegistrar, InjectQueue } from '@nestjs/bullmq';
import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import type { JobsOptions, Queue } from 'bullmq';
import { upstreamsConfig } from '../../../config/upstreams.config.js';

export const TOOL_SYNC_QUEUE = 'tool-sync';

export interface ToolSyncJob {
  connectionId: string;
}

// A sync reaches the upstream server, so it is retried with backoff. A sync
// is idempotent, so a second job for the same connection only repeats the
// work; it is not deduplicated, because a job already running could miss a
// change that queued the second one.
const JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 1_000 },
  removeOnComplete: true,
  removeOnFail: 100,
};

// Queues tool syncs (T18). ToolSyncProcessor runs them.
@Injectable()
export class ToolSyncService implements OnModuleInit {
  private readonly logger = new Logger(ToolSyncService.name);

  constructor(
    @InjectQueue(TOOL_SYNC_QUEUE) private readonly queue: Queue<ToolSyncJob>,
    private readonly registrar: BullRegistrar,
    @Inject(upstreamsConfig.KEY)
    private readonly upstreams: ConfigType<typeof upstreamsConfig>,
  ) {}

  // Workers run only where upstream clients do: without clients there is
  // nothing to list.
  onModuleInit(): void {
    if (this.upstreams.connecting) this.registrar.register();
  }

  // Called when a client connects, when its server reports a changed tool
  // list, and by the re-sync action. Returns at once.
  syncInBackground(connectionId: string): void {
    if (!this.upstreams.connecting) return;
    this.queue
      .add('sync', { connectionId }, JOB_OPTIONS)
      .catch((error: unknown) =>
        this.logger.warn(
          `Could not queue a tool sync for connection ${connectionId}: ${String(error)}`,
        ),
      );
  }
}
