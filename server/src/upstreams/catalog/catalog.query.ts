import { Query, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../caller/caller.js';
import { CurrentCaller } from '../../caller/current-caller.decorator.js';
import { CatalogService } from './catalog.service.js';
import { CatalogEntryModel } from './models/catalog-entry.model.js';

@Resolver(() => CatalogEntryModel)
export class CatalogQuery {
  constructor(private readonly catalogService: CatalogService) {}

  @Query(() => [CatalogEntryModel], {
    description:
      "Every catalog entry, sorted by display name, with the caller's connection (REQ-CONN-011).",
  })
  catalog(@CurrentCaller() caller: Caller): Promise<CatalogEntryModel[]> {
    return this.catalogService.listForOwner(caller.userId);
  }
}
