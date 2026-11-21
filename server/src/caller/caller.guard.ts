import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
} from '@nestjs/common';
import { type GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import type { CallerRequest } from './caller.js';
import { CallerService } from './caller.service.js';

// Global guard (APP_GUARD in CallerModule). It allows every GraphQL request
// and attaches the default caller; sign-in will replace this step only.
// Plain HTTP routes (health checks) act for no caller and pass through.
@Injectable()
export class CallerGuard implements CanActivate {
  constructor(private readonly callers: CallerService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType<GqlContextType>() !== 'graphql') return true;

    const { req } = GqlExecutionContext.create(context).getContext<{
      req: CallerRequest;
    }>();
    req.caller = await this.callers.getDefaultCaller();
    return true;
  }
}
