import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { Caller } from '../caller/caller.js';
import { CurrentCaller } from '../caller/current-caller.decorator.js';
import {
  CreateConnectionInput,
  UpdateConnectionInput,
} from './connection.input.js';
import { ConnectionModel } from './connection.model.js';
import { ConnectionsService } from './connections.service.js';

@Resolver(() => ConnectionModel)
export class ConnectionResolver {
  constructor(private readonly connectionsService: ConnectionsService) {}

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
