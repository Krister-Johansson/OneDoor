import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { OAuthService } from '../../../services/upstreams/auth/oauth/oauth.service.js';
import { ConnectionsService } from '../../../services/upstreams/connections/connections.service.js';
import { ConnectionModel } from './models/connection.model.js';

@Resolver(() => ConnectionModel)
export class ConnectionsQuery {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly oauthService: OAuthService,
  ) {}

  @Query(() => String, {
    description:
      'The redirect URI to register in an OAuth app for an OAUTH_MANUAL connection (T22). Not a secret.',
  })
  oauthRedirectUrl(): string {
    return this.oauthService.redirectUrl();
  }

  @Query(() => [ConnectionModel], {
    description: "The caller's connections, sorted by display name.",
  })
  connections(@CurrentCaller() caller: Caller): Promise<ConnectionModel[]> {
    return this.connectionsService.listForOwner(caller.userId);
  }

  @Query(() => ConnectionModel, {
    description: "One of the caller's connections. NOT_FOUND otherwise.",
  })
  connection(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ConnectionModel> {
    return this.connectionsService.getForOwner(caller.userId, id);
  }
}
