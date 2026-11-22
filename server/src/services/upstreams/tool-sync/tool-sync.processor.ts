import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import type { Job } from 'bullmq';
import { UpstreamRegistryService } from '../registry/upstream-registry.service.js';
import type { ToolSyncResult } from '../tools/tool.interface.js';
import { ToolsService } from '../tools/tools.service.js';
import { TOOL_SYNC_QUEUE, type ToolSyncJob } from './tool-sync.service.js';

// Lists a connection's tools through its upstream client and stores them.
// A thrown error fails the attempt, and BullMQ retries it; the stored tools
// stay as they are until a sync succeeds.
@Processor(TOOL_SYNC_QUEUE)
export class ToolSyncProcessor extends WorkerHost {
  private readonly logger = new Logger(ToolSyncProcessor.name);

  constructor(
    private readonly registry: UpstreamRegistryService,
    private readonly tools: ToolsService,
  ) {
    super();
  }

  async process(job: Job<ToolSyncJob>): Promise<ToolSyncResult | null> {
    const { connectionId } = job.data;
    // No connected client: the connection is disabled, not READY or not
    // reachable. The next connect queues a sync.
    const listed = await this.registry.listTools(connectionId);
    if (listed === null) return null;
    const result = await this.tools.replaceTools(connectionId, listed);
    if (result) {
      this.logger.log(
        `Synced the tools of connection ${connectionId}: ${result.added} added, ${result.changed} changed, ${result.removed} removed, ${result.unchanged} unchanged`,
      );
    }
    return result;
  }
}
