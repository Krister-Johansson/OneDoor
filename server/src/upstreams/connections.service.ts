import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import { InternalError, NotFoundError } from '../errors/domain-errors.js';
import type { CatalogEntry, Connection } from '../generated/prisma/client.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDomainError } from '../prisma/prisma-error.mapper.js';
import type { ConnectionModel } from './connection.model.js';

type ConnectionRow = Connection & { catalogEntry: CatalogEntry | null };

@Injectable()
export class ConnectionsService {
  constructor(private readonly prisma: PrismaService) {}

  // The owner's connections, sorted by display name, ignoring case.
  async listForOwner(ownerId: string): Promise<ConnectionModel[]> {
    let rows: ConnectionRow[];
    try {
      rows = await this.prisma.connection.findMany({
        where: { ownerId },
        include: { catalogEntry: true },
      });
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
    return rows.map(toConnectionModel).sort((a, b) =>
      a.displayName.localeCompare(b.displayName, 'en', {
        sensitivity: 'base',
      }),
    );
  }

  // One of the owner's connections. Another owner's connection, and an id
  // that is not a UUID, are not found (REQ-CONN-001).
  async getForOwner(ownerId: string, id: string): Promise<ConnectionModel> {
    if (!z.uuid().safeParse(id).success) {
      throw new NotFoundError('Connection not found');
    }
    let row: ConnectionRow | null;
    try {
      row = await this.prisma.connection.findFirst({
        where: { id, ownerId },
        include: { catalogEntry: true },
      });
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
    if (!row) throw new NotFoundError('Connection not found');
    return toConnectionModel(row);
  }
}

// A catalog-based connection takes these fields from its entry (REQ-CONN-012).
// The check constraint connection_catalog_or_custom_check guarantees that one
// of the two sources has them.
function toConnectionModel(row: ConnectionRow): ConnectionModel {
  const source = row.catalogEntry ?? row;
  const { displayName, url, authType } = source;
  if (displayName === null || url === null || authType === null) {
    throw new InternalError({
      cause: new Error(
        `Connection ${row.id} has no display name, URL or auth type`,
      ),
    });
  }
  return {
    id: row.id,
    catalogEntryId: row.catalogEntryId,
    displayName,
    description: source.description ?? '',
    url,
    authType,
    headerName: source.headerName,
    headerPrefix: source.headerPrefix,
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
