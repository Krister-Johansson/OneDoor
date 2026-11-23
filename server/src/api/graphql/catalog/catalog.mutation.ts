import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { AuthType } from '../../../generated/prisma/enums.js';
import { CatalogService } from '../../../services/upstreams/catalog/catalog.service.js';
import { ConnectionModel } from '../connections/models/connection.model.js';
import { SetCatalogOAuthClientInput } from './inputs/set-catalog-oauth-client.input.js';
import { UrlParameterInput } from './inputs/url-parameter.input.js';
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
    @Args('urlParameters', {
      type: () => [UrlParameterInput],
      nullable: true,
      description:
        "Values for the placeholders in the option's URL (T22). Left out keeps the stored values.",
    })
    urlParameters?: UrlParameterInput[] | null,
  ): Promise<ConnectionModel> {
    return this.catalogService.switchOn(
      caller.userId,
      catalogEntryId,
      authType,
      urlParameters ?? undefined,
    );
  }

  @Mutation(() => CatalogEntryModel, {
    description:
      "Sets the OAuth app of a catalog entry's OAUTH_MANUAL option and returns the entry (T22). Every connection on the option uses the app. Register the URL from oauthRedirectUrl in the app.",
  })
  setCatalogOAuthClient(
    @CurrentCaller() caller: Caller,
    @Args('catalogEntryId', { type: () => ID }) catalogEntryId: string,
    @Args('input') input: SetCatalogOAuthClientInput,
  ): Promise<CatalogEntryModel> {
    return this.catalogService.setOAuthClient(
      caller.userId,
      catalogEntryId,
      input,
    );
  }
}
