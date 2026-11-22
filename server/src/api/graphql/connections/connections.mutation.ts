import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { ConnectionsService } from '../../../services/upstreams/connections/connections.service.js';
import { CreateConnectionInput } from './inputs/create-connection.input.js';
import { UpdateConnectionInput } from './inputs/update-connection.input.js';
import { ConnectionModel } from './models/connection.model.js';

@Resolver(() => ConnectionModel)
export class ConnectionsMutation {
  constructor(private readonly connectionsService: ConnectionsService) {}

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
