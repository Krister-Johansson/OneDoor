import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
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
// - DomainError: its status and `{ statusCode, code, message }`.
// - HttpException (Nest's own, pipes, guards): passed through unchanged.
// - Anything else: logged, then answered as INTERNAL with a fixed message.
@Catch()
export class DomainErrorFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainErrorFilter.name);

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Only HTTP is served so far. GraphQL errors get their mapping when the
    // GraphQL API is added.
    if (host.getType() !== 'http') return exception;

    const { httpAdapter } = this.httpAdapterHost;
    const response = host.switchToHttp().getResponse();

    if (exception instanceof HttpException) {
      httpAdapter.reply(
        response,
        exception.getResponse(),
        exception.getStatus(),
      );
      return;
    }

    const error =
      exception instanceof DomainError
        ? exception
        : new InternalError({ cause: exception });
    const statusCode = httpStatusByCode[error.code];

    if (statusCode >= HttpStatus.INTERNAL_SERVER_ERROR) {
      const logged = error.cause ?? error;
      this.logger.error(
        `${error.code}: ${error.message}`,
        logged instanceof Error ? logged.stack : String(logged),
      );
    }

    httpAdapter.reply(
      response,
      { statusCode, code: error.code, message: error.message },
      statusCode,
    );
  }
}
