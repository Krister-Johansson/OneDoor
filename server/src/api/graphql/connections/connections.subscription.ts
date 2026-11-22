import { Resolver, Subscription } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { ConnectionsService } from '../../../services/upstreams/connections/connections.service.js';
import type { ConnectionStatusChanged } from '../../../services/upstreams/registry/connection-status.interface.js';
import { UpstreamRegistryService } from '../../../services/upstreams/registry/upstream-registry.service.js';
import type { ConnectionToolsSynced } from '../../../services/upstreams/tools/tool.interface.js';
import { ToolsService } from '../../../services/upstreams/tools/tools.service.js';
import { ConnectionModel } from './models/connection.model.js';

@Resolver(() => ConnectionModel)
export class ConnectionsSubscription {
  constructor(
    private readonly connectionsService: ConnectionsService,
    private readonly registry: UpstreamRegistryService,
    private readonly tools: ToolsService,
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

  @Subscription(() => ConnectionModel, {
    description:
      "Sends one of the caller's connections each time a sync of its tools finishes, with its new toolCount.",
    resolve(
      this: ConnectionsSubscription,
      event: ConnectionToolsSynced,
    ): Promise<ConnectionModel> {
      return this.connectionsService.getForOwner(
        event.ownerId,
        event.connectionId,
      );
    },
  })
  connectionToolsSynced(
    @CurrentCaller() caller: Caller,
  ): Promise<AsyncIterableIterator<ConnectionToolsSynced>> {
    return this.tools.toolSyncs(caller.userId);
  }
}
