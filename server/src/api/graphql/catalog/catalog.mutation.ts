import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { AuthType } from '../../../generated/prisma/enums.js';
import { CatalogService } from '../../../services/upstreams/catalog/catalog.service.js';
import { ConnectionModel } from '../connections/models/connection.model.js';
import { CatalogEntryModel } from './models/catalog-entry.model.js';

@Resolver(() => CatalogEntryModel)
export class CatalogMutation {
  constructor(private readonly catalogService: CatalogService) {}

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
