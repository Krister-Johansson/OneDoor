import { Query, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { CatalogService } from '../../../services/upstreams/catalog/catalog.service.js';
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
