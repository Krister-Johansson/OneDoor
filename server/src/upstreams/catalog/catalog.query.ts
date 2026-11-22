import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../caller/caller.js';
import { CurrentCaller } from '../../caller/current-caller.decorator.js';
import { AuthType } from '../../generated/prisma/enums.js';
import { ConnectionModel } from '../connections/models/connection.model.js';
import { CatalogService } from './catalog.service.js';
import { CatalogEntryModel } from './models/catalog-entry.model.js';

@Resolver(() => CatalogEntryModel)
export class CatalogEntryResolver {
  constructor(private readonly catalogService: CatalogService) {}

  @Query(() => [CatalogEntryModel], {
    description:
      "Every catalog entry, sorted by display name, with the caller's connection (REQ-CONN-011).",
  })
  catalog(@CurrentCaller() caller: Caller): Promise<CatalogEntryModel[]> {
    return this.catalogService.listForOwner(caller.userId);
  }

  @Mutation(() => ConnectionModel, {
    description:
      'Switches on a catalog entry with one of its auth options and returns the connection (REQ-CONN-012). Switch it off with setConnectionEnabled.',
  })
  switchOnCatalogEntry(
    @CurrentCaller() caller: Caller,
    @Args('catalogEntryId', { type: () => ID }) catalogEntryId: string,
    @Args('authType', { type: () => AuthType }) authType: AuthType,
  ): Promise<ConnectionModel> {
    return this.catalogService.switchOn(
      caller.userId,
      catalogEntryId,
      authType,
    );
  }
}
