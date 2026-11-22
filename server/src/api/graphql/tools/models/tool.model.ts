import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { Tool } from '../../../../services/upstreams/tools/tool.interface.js';
import { ToolAnnotationsModel } from './tool-annotations.model.js';

@ObjectType('Tool', {
  description:
    "A tool of one of the caller's connections, as the last tool sync stored it.",
})
export class ToolModel implements Tool {
  @Field(() => ID)
  id: string;

  @Field(() => ID)
  connectionId: string;

  @Field({ description: 'The name the upstream server uses.' })
  name: string;

  @Field(() => String, { nullable: true })
  title: string | null;

  @Field()
  description: string;

  @Field(() => ToolAnnotationsModel)
  annotations: ToolAnnotationsModel;

  @Field({
    description:
      'Set by the owner (T19). A new tool is enabled, and a sync keeps the flag. The gateway does not search or execute a disabled tool.',
  })
  enabled: boolean;
}
