import { Module } from '@nestjs/common';
import { TerminusModule } from '@nestjs/terminus';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IconsModule } from '../../services/icons/icons.module.js';
import { UpstreamsModule } from '../../services/upstreams/upstreams.module.js';
import { HealthController } from './health/health.controller.js';
import { RedisHealthIndicator } from './health/redis.health.js';
import { IconsController } from './icons/icons.controller.js';
import { OAuthController } from './oauth/oauth.controller.js';

// The plain HTTP routes: health checks, icons and the OAuth callback.
@Module({
  imports: [
    TerminusModule.forRoot(),
    PrismaModule,
    IconsModule,
    UpstreamsModule,
  ],
  controllers: [HealthController, IconsController, OAuthController],
  providers: [RedisHealthIndicator],
})
export class HttpApiModule {}
