import { Parent, ResolveField, Resolver } from '@nestjs/graphql';
import { ConnectionStatus } from '../../../services/upstreams/registry/connection-status.interface.js';
import { UpstreamRegistryService } from '../../../services/upstreams/registry/upstream-registry.service.js';
import { ToolsService } from '../../../services/upstreams/tools/tools.service.js';
import { ToolModel } from '../tools/models/tool.model.js';
import { ConnectionModel } from './models/connection.model.js';

@Resolver(() => ConnectionModel)
export class ConnectionResolver {
  constructor(
    private readonly registry: UpstreamRegistryService,
    private readonly toolsService: ToolsService,
  ) {}

  @ResolveField(() => ConnectionStatus, {
    description:
      "The state of the connection's upstream client in this server. Live updates come from connectionStatusChanged.",
  })
  status(@Parent() connection: ConnectionModel): ConnectionStatus {
    return this.registry.status(connection.id);
  }

  // The parent was loaded for its owner, so its tools are the caller's.
  @ResolveField(() => [ToolModel], {
    description: 'The tools the last tool sync stored, by name (T19).',
  })
  tools(@Parent() connection: ConnectionModel): Promise<ToolModel[]> {
    return this.toolsService.listForConnection(connection.id);
  }
}
