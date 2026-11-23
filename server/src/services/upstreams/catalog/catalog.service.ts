import { Injectable } from '@nestjs/common';
import { z } from 'zod';
import {
  ConflictError,
  NotFoundError,
  ValidationError,
} from '../../../errors/domain-errors.js';
import type { AuthType } from '../../../generated/prisma/enums.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { toDomainError } from '../../../prisma/prisma-error.mapper.js';
import { iconPath } from '../../icons/icons.service.js';
import type { Connection } from '../connections/connection.interface.js';
import {
  CONNECTION_INCLUDE,
  toConnection,
} from '../connections/connection.mapper.js';
import { UpstreamRegistryService } from '../registry/upstream-registry.service.js';
import type { CatalogEntry } from './catalog-entry.interface.js';

@Injectable()
export class CatalogService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly registry: UpstreamRegistryService,
  ) {}

  // REQ-CONN-011: every entry, sorted by display name, with its auth options
  // and the owner's connection for it.
  async listForOwner(ownerId: string): Promise<CatalogEntry[]> {
    try {
      const entries = await this.prisma.catalogEntry.findMany({
        orderBy: { displayName: 'asc' },
        include: {
          authOptions: { orderBy: { authType: 'asc' } },
          connections: { where: { ownerId }, include: CONNECTION_INCLUDE },
        },
      });
      return entries.map((entry) => ({
        id: entry.id,
        key: entry.key,
        displayName: entry.displayName,
        description: entry.description,
        iconUrl: iconPath(entry.iconId, entry.displayName),
        authOptions: entry.authOptions.map((option) => ({
          authType: option.authType,
          url: option.url,
          headerName: option.headerName,
          headerPrefix: option.headerPrefix,
        })),
        connection: entry.connections[0]
          ? toConnection(entry.connections[0])
          : null,
      }));
    } catch (error) {
      throw toDomainError(error, 'Catalog entry');
    }
  }

  // REQ-CONN-012: creates the owner's connection for the entry, or enables
  // the existing one. Moving to another auth option deletes the stored
  // credentials, as a changed auth type does (REQ-CONN-023).
  async switchOn(
    ownerId: string,
    catalogEntryId: string,
    authType: AuthType,
  ): Promise<Connection> {
    if (!z.uuid().safeParse(catalogEntryId).success) {
      throw new NotFoundError('Catalog entry not found');
    }
    try {
      const entry = await this.prisma.catalogEntry.findUnique({
        where: { id: catalogEntryId },
        include: { authOptions: true },
      });
      if (!entry) throw new NotFoundError('Catalog entry not found');

      const option = entry.authOptions.find((o) => o.authType === authType);
      if (!option) {
        throw new ValidationError(
          `This catalog entry does not offer ${authType}`,
        );
      }

      // REQ-CONN-021: the entry's name must not match a custom connection.
      const custom = await this.prisma.connection.findFirst({
        where: {
          ownerId,
          catalogEntryId: null,
          displayName: { equals: entry.displayName },
        },
        select: { id: true },
      });
      if (custom) {
        throw new ConflictError(
          'A custom connection already has this name. Rename it to switch on the catalog entry',
        );
      }

      const existing = await this.prisma.connection.findFirst({
        where: { ownerId, catalogEntryId },
        select: { id: true, catalogAuthOptionId: true },
      });
      if (!existing) {
        const created = await this.prisma.connection.create({
          data: { ownerId, catalogEntryId, catalogAuthOptionId: option.id },
          include: CONNECTION_INCLUDE,
        });
        this.registry.syncInBackground(created.id);
        return toConnection(created);
      }

      const sameOption = existing.catalogAuthOptionId === option.id;
      const updated = await this.prisma.$transaction(async (tx) => {
        // Another auth option starts from no credentials, OAuth included.
        if (!sameOption) {
          await tx.connectionOAuth.deleteMany({
            where: { connectionId: existing.id },
          });
        }
        return tx.connection.update({
          where: { id: existing.id, ownerId },
          data: sameOption
            ? { enabled: true }
            : {
                enabled: true,
                catalogAuthOptionId: option.id,
                apiKeyCiphertext: null,
                apiKeyKeyId: null,
              },
          include: CONNECTION_INCLUDE,
        });
      });
      this.registry.syncInBackground(updated.id);
      return toConnection(updated);
    } catch (error) {
      throw toDomainError(error, 'Connection');
    }
  }
}
