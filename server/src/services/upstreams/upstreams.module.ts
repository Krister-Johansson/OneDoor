import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { SecretStore } from '../../crypto/secret-store.js';
import { EventsModule } from '../../events/events.module.js';
import { NetModule } from '../../net/net.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { QueueModule } from '../../queue/queue.module.js';
import { IconsModule } from '../icons/icons.module.js';
import { ApiKeyAuthProvider } from './auth/api-key-auth-provider.js';
import { NoneAuthProvider } from './auth/none-auth-provider.js';
import { UpstreamAuthProviders } from './auth/upstream-auth-providers.js';
import { CatalogService } from './catalog/catalog.service.js';
import { ConnectionsService } from './connections/connections.service.js';
import { IconRefreshService } from './icon-refresh/icon-refresh.service.js';
import { ProbeService } from './probe/probe.service.js';
import { UpstreamRegistryService } from './registry/upstream-registry.service.js';
import { ToolSyncProcessor } from './tool-sync/tool-sync.processor.js';
import {
  TOOL_SYNC_QUEUE,
  ToolSyncService,
} from './tool-sync/tool-sync.service.js';
import { ToolsService } from './tools/tools.service.js';

// Connections, the catalog, probing, upstream clients and tool sync. No
// transport: the API modules import this one and expose the services.
@Module({
  imports: [
    PrismaModule,
    CryptoModule,
    NetModule,
    EventsModule,
    QueueModule,
    BullModule.registerQueue({ name: TOOL_SYNC_QUEUE }),
    IconsModule,
  ],
  providers: [
    ConnectionsService,
    CatalogService,
    ProbeService,
    IconRefreshService,
    UpstreamRegistryService,
    ToolSyncService,
    ToolSyncProcessor,
    ToolsService,
    {
      // One provider per auth type the registry can connect with (T20).
      provide: UpstreamAuthProviders,
      inject: [SecretStore],
      useFactory: (secretStore: SecretStore) =>
        new UpstreamAuthProviders([
          new NoneAuthProvider(),
          new ApiKeyAuthProvider(secretStore),
        ]),
    },
  ],
  exports: [
    ConnectionsService,
    CatalogService,
    ProbeService,
    UpstreamRegistryService,
    ToolsService,
  ],
})
export class UpstreamsModule {}
