import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import {
  type CredentialsCheck,
  CredentialsStatus,
} from '../../../../services/upstreams/probe/probe.interface.js';

registerEnumType(CredentialsStatus, {
  name: 'CredentialsStatus',
  description:
    'OK: connected and listed the tools. REFUSED_CREDENTIALS: the server answered 401 or 403. The other values mean the same as in ProbeStatus.',
});

@ObjectType('CredentialsCheck', {
  description: 'The result of connecting with credentials (REQ-CONN-062).',
})
export class CredentialsCheckModel implements CredentialsCheck {
  @Field(() => CredentialsStatus)
  status: CredentialsStatus;

  @Field()
  message: string;

  @Field(() => Int, { nullable: true })
  toolCount: number | null;

  @Field(() => [String], { description: 'The first five tool names.' })
  toolNames: string[];
}
