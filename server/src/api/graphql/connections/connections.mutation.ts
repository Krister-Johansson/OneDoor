import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { OAuthService } from '../../../services/upstreams/auth/oauth/oauth.service.js';
import { ConnectionsService } from '../../../services/upstreams/connections/connections.service.js';
import { CreateConnectionInput } from './inputs/create-connection.input.js';
import { UpdateConnectionInput } from './inputs/update-connection.input.js';
import { ConnectionModel } from './models/connection.model.js';

@Resolver(() => ConnectionModel)
export class ConnectionsMutation {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly oauthService: OAuthService,
  ) {}

  @Mutation(() => String, {
    description:
      "Starts the OAuth authorization of an OAUTH_DCR or OAUTH_MANUAL connection and returns the URL to send the browser to (T21, T22). For OAUTH_DCR, OneDoor registers itself with the authorization server first when it has no client there; OAUTH_MANUAL uses the connection's OAuth app. The flow ends at the OAuth callback within 10 minutes. VALIDATION for another auth type or an OAUTH_MANUAL connection without a client id, UPSTREAM_UNAVAILABLE when discovery or registration fails.",
  })
  startOAuthAuthorization(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<string> {
    return this.oauthService.start(caller.userId, id);
  }

  @Mutation(() => ConnectionModel, {
    description: 'Adds a custom server (REQ-CONN-020).',
  })
  createConnection(
    @CurrentCaller() caller: Caller,
    @Args('input') input: CreateConnectionInput,
  ): Promise<ConnectionModel> {
    return this.connectionsService.create(caller.userId, input);
  }

  @Mutation(() => ConnectionModel, {
    description: 'Changes a custom server (REQ-CONN-023, REQ-CONN-042).',
  })
  updateConnection(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('input') input: UpdateConnectionInput,
  ): Promise<ConnectionModel> {
    return this.connectionsService.update(caller.userId, id, input);
  }

  @Mutation(() => ConnectionModel, {
    description: 'Enables or disables a connection (REQ-CONN-051).',
  })
  setConnectionEnabled(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('enabled') enabled: boolean,
  ): Promise<ConnectionModel> {
    return this.connectionsService.setEnabled(caller.userId, id, enabled);
  }

  @Mutation(() => ConnectionModel, {
    description:
      "Queues a sync of the connection's tools with its upstream server. UPSTREAM_UNAVAILABLE when the connection is not CONNECTED.",
  })
  resyncTools(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<ConnectionModel> {
    return this.connectionsService.resyncTools(caller.userId, id);
  }

  @Mutation(() => ID, {
    description:
      'Removes a connection with its credentials, and returns its id (REQ-CONN-052).',
  })
  removeConnection(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
  ): Promise<string> {
    return this.connectionsService.remove(caller.userId, id);
  }
}
