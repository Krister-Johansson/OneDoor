import { Module } from '@nestjs/common';
import { IconsController } from '../../api/http/icons/icons.controller.js';
import { NetModule } from '../../net/net.module.js';
import { PrismaModule } from '../../prisma/prisma.module.js';
import { IconsService } from './icons.service.js';

@Module({
  imports: [PrismaModule, NetModule],
  controllers: [IconsController],
  providers: [IconsService],
  exports: [IconsService],
})
export class IconsModule {}
