import {
  ConflictError,
  DomainError,
  InternalError,
  NotFoundError,
  ValidationError,
} from '../errors/domain-errors.js';
import { Prisma } from '../generated/prisma/client.js';

// Turns an error from a Prisma call into a domain error. Services call it in
// a catch block, so nothing above the data layer sees a Prisma error:
//
//   try {
//     return await this.prisma.connection.create({ data });
//   } catch (error) {
//     throw toDomainError(error, 'Connection');
//   }
export function toDomainError(error: unknown, resource: string): DomainError {
  if (error instanceof DomainError) return error;

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    switch (error.code) {
      // Unique constraint failed.
      case 'P2002':
        return new ConflictError(`${resource} already exists`, {
          cause: error,
        });
      // Foreign key constraint failed.
      case 'P2003':
        return new ConflictError(
          `${resource} conflicts with a related record`,
          {
            cause: error,
          },
        );
      // The record to update or delete does not exist.
      case 'P2025':
        return new NotFoundError(`${resource} not found`, { cause: error });
      // A value is too long for its column.
      case 'P2000':
        return new ValidationError(`A value is too long for ${resource}`, {
          cause: error,
        });
    }
  }

  return new InternalError({ cause: error });
}
