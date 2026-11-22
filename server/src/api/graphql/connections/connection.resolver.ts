import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ConnectionStatus } from '../../../services/upstreams/registry/connection-status.interface.js';
import { UpstreamRegistryService } from '../../../services/upstreams/registry/upstream-registry.service.js';
import { ConnectionModel } from './models/connection.model.js';

@Resolver(() => ConnectionModel)
export class ConnectionResolver {
  constructor(private readonly registry: UpstreamRegistryService) {}

  @ResolveField(() => ConnectionStatus, {
    description:
      "The state of the connection's upstream client in this server. Live updates come from connectionStatusChanged.",
  })
  status(@Parent() connection: ConnectionModel): ConnectionStatus {
    return this.registry.status(connection.id);
  }
}
