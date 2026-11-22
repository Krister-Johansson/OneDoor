import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogService } from './catalog.service.js';
import { CatalogEntryResolver } from './catalog-entry.resolver.js';
import { ConnectionResolver } from './connection.resolver.js';
import { ConnectionsService } from './connections.service.js';

@Module({
  imports: [PrismaModule, CryptoModule],
  providers: [
    ConnectionsService,
    ConnectionResolver,
    CatalogService,
    CatalogEntryResolver,
  ],
})
export class UpstreamsModule {}
