import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from '../prisma/prisma.module.js';
import { CallerGuard } from './caller.guard.js';
import { CallerService } from './caller.service.js';

@Module({
  imports: [PrismaModule],
  providers: [CallerService, { provide: APP_GUARD, useClass: CallerGuard }],
  exports: [CallerService],
})
export class CallerModule {}
