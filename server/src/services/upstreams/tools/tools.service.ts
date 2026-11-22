import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { toDomainError } from '../../../prisma/prisma-error.mapper.js';
import type { ToolSyncResult, UpstreamTool } from './tool.interface.js';
import { toolContentHash } from './tool-hash.js';

// The stored tools of each connection.
@Injectable()
export class ToolsService {
  constructor(private readonly prisma: PrismaService) {}

  // Makes the connection's stored tools match `listed`, the tools its
  // upstream server listed just now. A tool keeps its id while its name
  // stays; its row is rewritten only when its content hash changes. Returns
  // null when the connection no longer exists.
  async replaceTools(
    connectionId: string,
    listed: UpstreamTool[],
  ): Promise<ToolSyncResult | null> {
    // A server that lists a name twice is taken at its last entry.
    const byName = new Map(listed.map((tool) => [tool.name, tool]));
    try {
      return await this.prisma.$transaction(async (tx) => {
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
        return result;
      });
    } catch (error) {
      throw toDomainError(error, 'Tool');
    }
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
