import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module.js';
import { IconsModule } from '../icons/icons.module.js';
import { NetModule } from '../net/net.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogEntryResolver } from './catalog/catalog.query.js';
import { CatalogService } from './catalog/catalog.service.js';
import { ConnectionResolver } from './connections/connections.query.js';
import { ConnectionsService } from './connections/connections.service.js';
import { IconRefreshService } from './icon-refresh/icon-refresh.service.js';
import { ProbeResolver } from './probe/probe.mutation.js';
import { ProbeService } from './probe/probe.service.js';

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
