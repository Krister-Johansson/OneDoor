import { Args, ID, Mutation, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { ToolsService } from '../../../services/upstreams/tools/tools.service.js';
import { ToolModel } from './models/tool.model.js';

@Resolver(() => ToolModel)
export class ToolsMutation {
  constructor(private readonly toolsService: ToolsService) {}

  @Mutation(() => ToolModel, {
    description: "Enables or disables one of the caller's tools (T19).",
  })
  setToolEnabled(
    @CurrentCaller() caller: Caller,
    @Args('id', { type: () => ID }) id: string,
    @Args('enabled') enabled: boolean,
  ): Promise<ToolModel> {
    return this.toolsService.setEnabled(caller.userId, id, enabled);
  }
}
