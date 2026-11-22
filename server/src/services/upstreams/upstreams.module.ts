import { Module } from '@nestjs/common';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { NetModule } from '../../net/net.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IconsModule } from '../icons/icons.module.js';
import { CatalogService } from './catalog/catalog.service.js';
import { ConnectionsService } from './connections/connections.service.js';
import { IconRefreshService } from './icon-refresh/icon-refresh.service.js';
import { ProbeService } from './probe/probe.service.js';

// Connections, the catalog and probing. No transport: the API modules
// import this one and expose the services.
@Module({
  imports: [PrismaModule, CryptoModule, NetModule, IconsModule],
  providers: [
    ConnectionsService,
    CatalogService,
    ProbeService,
    IconRefreshService,
  ],
  exports: [ConnectionsService, CatalogService, ProbeService],
})
export class UpstreamsModule {}
