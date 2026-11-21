import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { GqlContextType } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';
import {
  DomainError,
  type DomainErrorCode,
  InternalError,
} from './domain-errors.js';

const httpStatusByCode: Record<DomainErrorCode, HttpStatus> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,
  CONFLICT: HttpStatus.CONFLICT,
  FORBIDDEN: HttpStatus.FORBIDDEN,
  VALIDATION: HttpStatus.BAD_REQUEST,
  UPSTREAM_UNAVAILABLE: HttpStatus.BAD_GATEWAY,
  INTERNAL: HttpStatus.INTERNAL_SERVER_ERROR,
};

// The one global filter, registered with APP_FILTER in AppModule.
// - HttpException (Nest's own, pipes, guards): passed through unchanged.
// - DomainError: over HTTP its status and `{ statusCode, code, message }`;
//   over GraphQL a GraphQLError with `extensions.code`.
// - Anything else: logged, then answered as INTERNAL with a fixed message.
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const type = host.getType<GqlContextType>();
    if (type !== 'http' && type !== 'graphql') return exception;
    if (exception instanceof HttpException) {
      if (type === 'graphql') return exception;
      this.httpAdapterHost.httpAdapter.reply(
        host.switchToHttp().getResponse(),
        exception.getResponse(),
        exception.getStatus(),
      );
      return;
    }

    const error = this.toDomainError(exception);

    if (type === 'graphql') {
      return new GraphQLError(error.message, {
        extensions: { code: error.code },
      });
    }

    const statusCode = httpStatusByCode[error.code];
    this.httpAdapterHost.httpAdapter.reply(
      host.switchToHttp().getResponse(),
      { statusCode, code: error.code, message: error.message },
      statusCode,
    );
  }

  // Turns anything thrown into a domain error, and logs the ones that are
  // the server's fault with the original error.
  private toDomainError(exception: unknown): DomainError {
    const error =
      exception instanceof DomainError
        ? exception
        : new InternalError({ cause: exception });
    if (httpStatusByCode[error.code] >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const logged = error.cause ?? error;
      this.logger.error(
        `${error.code}: ${error.message}`,
        logged instanceof Error ? logged.stack : String(logged),
      );
    }
    return error;
  }
}
