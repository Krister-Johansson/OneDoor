import { Injectable } from '@nestjs/common';
import { InternalError } from '../errors/domain-errors.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { toDomainError } from '../prisma/prisma-error.mapper.js';
import { type Caller, DEFAULT_USER_NAME } from './caller.js';

@Injectable()
export class CallerService {
  // The user id never changes, so it is loaded once. A failed load is not
  // kept, so the next request tries again.
  private defaultCaller?: Promise<Caller>;

  constructor(private readonly prisma: PrismaService) {}

  getDefaultCaller(): Promise<Caller> {
    this.defaultCaller ??= this.loadDefaultCaller().catch((error: unknown) => {
      this.defaultCaller = undefined;
      throw error;
    });
    return this.defaultCaller;
  }

  private async loadDefaultCaller(): Promise<Caller> {
    let user: { id: string; name: string } | null;
    try {
      user = await this.prisma.user.findUnique({
        where: { name: DEFAULT_USER_NAME },
        select: { id: true, name: true },
      });
    } catch (error) {
      throw toDomainError(error, 'User');
    }
    if (!user) {
      throw new InternalError({
        cause: new Error(
          `User "${DEFAULT_USER_NAME}" does not exist. Run pnpm prisma db seed.`,
        ),
      });
    }
    return { userId: user.id, userName: user.name };
  }
}
