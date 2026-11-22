import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { NotFoundError } from '../../../errors/domain-errors.js';
import { EventBus } from '../../../events/event-bus.js';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { toDomainError } from '../../../prisma/prisma-error.mapper.js';
import {
  CONNECTION_TOOLS_SYNCED,
  type ConnectionToolsSynced,
  type Tool,
  type ToolSyncResult,
  type UpstreamTool,
} from './tool.interface.js';
import { toTool } from './tool.mapper.js';
import { toolContentHash } from './tool-hash.js';

// The stored tools of each connection.
@Injectable()
export class ToolsService {
  private readonly logger = new Logger(ToolsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventBus: EventBus,
  ) {}

  // The stored tools of a connection, by name. The caller has checked that
  // the connection belongs to its owner.
  async listForConnection(connectionId: string): Promise<Tool[]> {
    try {
      const rows = await this.prisma.tool.findMany({
        where: { connectionId },
        orderBy: { name: 'asc' },
      });
      return rows.map(toTool);
    } catch (error) {
      throw toDomainError(error, 'Tool');
    }
  }

  // Enables or disables one of the owner's tools (T19). A sync keeps the
  // flag.
  async setEnabled(
    ownerId: string,
    id: string,
    enabled: boolean,
  ): Promise<Tool> {
    if (!z.uuid().safeParse(id).success) {
      throw new NotFoundError('Tool not found');
    }
    try {
      return toTool(
        await this.prisma.tool.update({
          where: { id, ownerId },
          data: { enabled },
        }),
      );
    } catch (error) {
      throw toDomainError(error, 'Tool');
    }
  }

  // The syncs of the owner's connections, as they finish.
  toolSyncs(
    ownerId: string,
  ): Promise<AsyncIterableIterator<ConnectionToolsSynced>> {
    return this.eventBus.subscribe(
      CONNECTION_TOOLS_SYNCED,
      (event) => event.ownerId === ownerId,
    );
  }

  // Makes the connection's stored tools match `listed`, the tools its
  // upstream server listed just now. A tool keeps its id while its name
  // stays; its row is rewritten only when its content hash changes. Returns
  // null when the connection no longer exists. Each stored sync is
  // published on the EventBus.
  async replaceTools(
    connectionId: string,
    listed: UpstreamTool[],
  ): Promise<ToolSyncResult | null> {
    // A server that lists a name twice is taken at its last entry.
    const byName = new Map(listed.map((tool) => [tool.name, tool]));
    let synced: { result: ToolSyncResult; ownerId: string } | null;
    try {
      synced = await this.prisma.$transaction(async (tx) => {
        const connection = await tx.connection.findUnique({
          where: { id: connectionId },
          select: { ownerId: true },
        });
        if (!connection) return null;

        const stored = await tx.tool.findMany({
          where: { connectionId },
          select: { id: true, name: true, contentHash: true },
        });
        const result: ToolSyncResult = {
          added: 0,
          changed: 0,
          removed: 0,
          unchanged: 0,
        };

        const gone = stored.filter((tool) => !byName.has(tool.name));
        if (gone.length > 0) {
          await tx.tool.deleteMany({
            where: { id: { in: gone.map((tool) => tool.id) } },
          });
          result.removed = gone.length;
        }

        const storedByName = new Map(stored.map((tool) => [tool.name, tool]));
        for (const tool of byName.values()) {
          const contentHash = toolContentHash(tool);
          const existing = storedByName.get(tool.name);
          if (existing?.contentHash === contentHash) {
            result.unchanged += 1;
            continue;
          }
          const data = { ...toolColumns(tool), contentHash };
          if (existing) {
            await tx.tool.update({ where: { id: existing.id }, data });
            result.changed += 1;
          } else {
            await tx.tool.create({
              data: { ...data, connectionId, ownerId: connection.ownerId },
            });
            result.added += 1;
          }
        }
        return { result, ownerId: connection.ownerId };
      });
    } catch (error) {
      throw toDomainError(error, 'Tool');
    }
    if (!synced) return null;
    this.published(connectionId, synced.ownerId);
    return synced.result;
  }

  // Publishes in the background: a sync never waits for Redis.
  private published(connectionId: string, ownerId: string): void {
    this.eventBus
      .publish(CONNECTION_TOOLS_SYNCED, { connectionId, ownerId })
      .catch((error: unknown) =>
        this.logger.warn(
          `Could not publish the tool sync of connection ${connectionId}: ${String(error)}`,
        ),
      );
  }
}

// The listed tool as columns. The SDK has parsed the JSON, so the schemas
// and annotations are JSON values.
function toolColumns(tool: UpstreamTool) {
  return {
    name: tool.name,
    title: tool.title ?? null,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema as Prisma.InputJsonObject,
    outputSchema:
      tool.outputSchema === undefined
        ? Prisma.DbNull
        : (tool.outputSchema as Prisma.InputJsonObject),
    annotations:
      tool.annotations === undefined
        ? Prisma.DbNull
        : (tool.annotations as Prisma.InputJsonObject),
  };
}
