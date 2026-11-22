import { Field, ObjectType } from '@nestjs/graphql';
import type { ToolAnnotations } from '../../../../services/upstreams/tools/tool.interface.js';

@ObjectType('ToolAnnotations', {
  description:
    'The MCP annotation hints of a tool. The upstream server sets them and may get them wrong: OneDoor shows them as labels and never enforces them. A hint the server did not send as a boolean is null.',
})
export class ToolAnnotationsModel implements ToolAnnotations {
  @Field(() => Boolean, { nullable: true })
  readOnlyHint: boolean | null;

  @Field(() => Boolean, { nullable: true })
  destructiveHint: boolean | null;

  @Field(() => Boolean, { nullable: true })
  idempotentHint: boolean | null;

  @Field(() => Boolean, { nullable: true })
  openWorldHint: boolean | null;
}
