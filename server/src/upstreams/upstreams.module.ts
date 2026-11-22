import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module.js';
import { IconsModule } from '../icons/icons.module.js';
import { NetModule } from '../net/net.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CatalogMutation } from './catalog/catalog.mutation.js';
import { CatalogQuery } from './catalog/catalog.query.js';
import { CatalogService } from './catalog/catalog.service.js';
import { ConnectionsMutation } from './connections/connections.mutation.js';
import { ConnectionsQuery } from './connections/connections.query.js';
import { ConnectionsService } from './connections/connections.service.js';
import { IconRefreshService } from './icon-refresh/icon-refresh.service.js';
import { ProbeMutation } from './probe/probe.mutation.js';
import { ProbeService } from './probe/probe.service.js';

@Module({
  imports: [PrismaModule, CryptoModule, NetModule, IconsModule],
  providers: [
    ConnectionsService,
    ConnectionsQuery,
    ConnectionsMutation,
    CatalogService,
    CatalogQuery,
    CatalogMutation,
    ProbeService,
    ProbeMutation,
    IconRefreshService,
  ],
})
export class UpstreamsModule {}
