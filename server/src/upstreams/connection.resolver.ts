import { Args, ID, Query, Resolver } from '@nestjs/graphql';
import type { Caller } from '../caller/caller.js';
import { CurrentCaller } from '../caller/current-caller.decorator.js';
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
}
