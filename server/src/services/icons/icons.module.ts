import { Module } from '@nestjs/common';
import { NetModule } from '../../net/net.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IconsService } from './icons.service.js';

@Module({
  imports: [PrismaModule, NetModule],
  providers: [IconsService],
  exports: [IconsService],
})
export class IconsModule {}
