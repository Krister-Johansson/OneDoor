import {
  ConflictError,
  ForbiddenError,
  InternalError,
  NotFoundError,
  ValidationError,
} from '../errors/domain-errors.js';
import { Prisma } from '../generated/prisma/client.js';
import { toDomainError } from './prisma-error.mapper.js';

function knownError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`Prisma error ${code}`, {
    code,
    clientVersion: Prisma.prismaVersion.client,
  });
}

describe('toDomainError', () => {
  it.each([
    ['P2002', ConflictError, 'Connection already exists'],
    ['P2003', ConflictError, 'Connection conflicts with a related record'],
    ['P2025', NotFoundError, 'Connection not found'],
    ['P2000', ValidationError, 'A value is too long for Connection'],
  ])('maps %s to %O', (code, type, message) => {
    const prismaError = knownError(code);
    const result = toDomainError(prismaError, 'Connection');

    expect(result).toBeInstanceOf(type);
    expect(result.message).toBe(message);
    expect(result.cause).toBe(prismaError);
  });

  it('maps an unknown Prisma code to an internal error', () => {
    const prismaError = knownError('P2034');
    const result = toDomainError(prismaError, 'Connection');

    expect(result).toBeInstanceOf(InternalError);
    expect(result.message).toBe('Internal server error');
    expect(result.cause).toBe(prismaError);
  });

  it('maps any other error to an internal error', () => {
    const error = new Error('connect ECONNREFUSED 127.0.0.1:5432');
    const result = toDomainError(error, 'Connection');

    expect(result).toBeInstanceOf(InternalError);
    expect(result.message).not.toContain('ECONNREFUSED');
    expect(result.cause).toBe(error);
  });

  it('returns a domain error unchanged', () => {
    const error = new ForbiddenError('Tool is disabled');
    expect(toDomainError(error, 'Connection')).toBe(error);
  });
});
