import { Module } from '@nestjs/common';
import { NetModule } from '../net/net.module.js';
import { PrismaModule } from '../prisma/prisma.module.js';
import { IconsController } from './icons.controller.js';
import { IconsService } from './icons.service.js';

@Module({
  imports: [PrismaModule, NetModule],
  controllers: [IconsController],
  providers: [IconsService],
  exports: [IconsService],
})
export class IconsModule {}
