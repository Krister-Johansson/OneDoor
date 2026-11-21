import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConnectionResolver } from './connection.resolver.js';
import { ConnectionsService } from './connections.service.js';

@Module({
  imports: [PrismaModule],
  providers: [ConnectionsService, ConnectionResolver],
})
export class UpstreamsModule {}
