import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module.js';
import { IconsModule } from '../icons/icons.module.js';
import { NetModule } from '../net/net.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogService } from './catalog.service.js';
import { CatalogEntryResolver } from './catalog-entry.resolver.js';
import { ConnectionResolver } from './connection.resolver.js';
import { ConnectionsService } from './connections.service.js';
import { IconRefreshService } from './icon-refresh.service.js';
import { ProbeResolver } from './probe.resolver.js';
import { ProbeService } from './probe.service.js';

@Module({
  imports: [PrismaModule, CryptoModule, NetModule, IconsModule],
  providers: [
    ConnectionsService,
    ConnectionResolver,
    CatalogService,
    CatalogEntryResolver,
    ProbeService,
    ProbeResolver,
    IconRefreshService,
  ],
})
export class UpstreamsModule {}
