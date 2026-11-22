import { Module } from '@nestjs/common';
import { CatalogMutation } from '../../api/graphql/catalog/catalog.mutation.js';
import { CatalogQuery } from '../../api/graphql/catalog/catalog.query.js';
import { ConnectionsMutation } from '../../api/graphql/connections/connections.mutation.js';
import { ConnectionsQuery } from '../../api/graphql/connections/connections.query.js';
import { ProbeMutation } from '../../api/graphql/probe/probe.mutation.js';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { NetModule } from '../../net/net.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IconsModule } from '../icons/icons.module.js';
import { CatalogService } from './catalog/catalog.service.js';
import { ConnectionsService } from './connections/connections.service.js';
import { IconRefreshService } from './icon-refresh/icon-refresh.service.js';
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
