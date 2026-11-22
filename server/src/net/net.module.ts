import { Module } from '@nestjs/common';
import { GuardedFetch } from './guarded-fetch.js';

@Module({
  providers: [{ provide: GuardedFetch, useFactory: () => new GuardedFetch() }],
  exports: [GuardedFetch],
})
export class NetModule {}
