import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { InternalError } from '../errors/domain-errors.js';
import type { Caller, CallerRequest } from './caller.js';

// The caller that CallerGuard attached. Fails loudly instead of acting for
// nobody when the guard did not run.
export const CurrentCaller = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Caller => {
    const { req } = GqlExecutionContext.create(context).getContext<{
      req?: CallerRequest;
    }>();
    if (!req?.caller) {
      throw new InternalError({
        cause: new Error(
          'No caller on the request. Is CallerGuard registered?',
        ),
      });
    }
    return req.caller;
  },
);
