import { Module } from '@nestjs/common';
import { CryptoModule } from '../crypto/crypto.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { ConnectionResolver } from './connection.resolver.js';
import { ConnectionsService } from './connections.service.js';

@Module({
  imports: [PrismaModule, CryptoModule],
  providers: [ConnectionsService, ConnectionResolver],
})
export class UpstreamsModule {}
