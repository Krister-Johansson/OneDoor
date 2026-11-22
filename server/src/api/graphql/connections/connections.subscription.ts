import { Resolver, Subscription } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { ConnectionsService } from '../../../services/upstreams/connections/connections.service.js';
import type { ConnectionStatusChanged } from '../../../services/upstreams/registry/connection-status.interface.js';
import { UpstreamRegistryService } from '../../../services/upstreams/registry/upstream-registry.service.js';
import { ConnectionModel } from './models/connection.model.js';

@Resolver(() => ConnectionModel)
export class ConnectionsSubscription {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly registry: UpstreamRegistryService,
  ) {}

  // The event carries ids; `resolve` loads the connection, whose status
  // field then reads the registry.
  @Subscription(() => ConnectionModel, {
    description:
      "Sends one of the caller's connections each time its status changes.",
    resolve(
      this: ConnectionsSubscription,
      event: ConnectionStatusChanged,
    ): Promise<ConnectionModel> {
      return this.connectionsService.getForOwner(
        event.ownerId,
        event.connectionId,
      );
    },
  })
  connectionStatusChanged(
    @CurrentCaller() caller: Caller,
  ): Promise<AsyncIterableIterator<ConnectionStatusChanged>> {
    return this.registry.statusChanges(caller.userId);
  }
}
