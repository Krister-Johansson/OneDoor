import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { redisConfig } from '../../config/redis.config.js';
import { upstreamsConfig } from '../../config/upstreams.config.js';
import { CryptoModule } from '../../crypto/crypto.module.js';
import { SecretStore } from '../../crypto/secret-store.js';
import { EventsModule } from '../../events/events.module.js';
import { NetModule } from '../../net/net.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { QueueModule } from '../../queue/queue.module.js';
import { IconsModule } from '../icons/icons.module.js';
import { ApiKeyAuthProvider } from './auth/api-key-auth-provider.js';
import { NoneAuthProvider } from './auth/none-auth-provider.js';
import { ConnectionOAuthService } from './auth/oauth/connection-oauth.service.js';
import { OAuthService } from './auth/oauth/oauth.service.js';
import { OAuthFlowStore } from './auth/oauth/oauth-flow-store.js';
import { RedisOAuthFlowStore } from './auth/oauth/redis-oauth-flow-store.js';
import { OAuthDcrAuthProvider } from './auth/oauth-dcr-auth-provider.js';
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
      inject: [SecretStore, ConnectionOAuthService, upstreamsConfig.KEY],
      useFactory: (
        secretStore: SecretStore,
        oauth: ConnectionOAuthService,
        upstreams: ConfigType<typeof upstreamsConfig>,
      ) =>
        new UpstreamAuthProviders([
          new NoneAuthProvider(),
          new ApiKeyAuthProvider(secretStore),
          new OAuthDcrAuthProvider(oauth, upstreams.oauthRedirectUrl),
        ]),
    },
    ConnectionOAuthService,
    OAuthService,
    {
      // Authorizations in progress, between the redirect and the callback.
      provide: OAuthFlowStore,
      inject: [redisConfig.KEY],
      useFactory: (redis: ConfigType<typeof redisConfig>): OAuthFlowStore =>
        new RedisOAuthFlowStore(redis.url),
    },
  ],
  exports: [
    ConnectionsService,
    CatalogService,
    ProbeService,
    UpstreamRegistryService,
    ToolsService,
    OAuthService,
  ],
})
export class UpstreamsModule {}
