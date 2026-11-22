import { Field, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AuthType } from '../generated/prisma/enums.js';

export const ProbeStatus = {
  MCP_SERVER: 'MCP_SERVER',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  NOT_MCP: 'NOT_MCP',
  UNREACHABLE: 'UNREACHABLE',
  REFUSED: 'REFUSED',
} as const;
export type ProbeStatus = (typeof ProbeStatus)[keyof typeof ProbeStatus];

registerEnumType(ProbeStatus, {
  name: 'ProbeStatus',
  description:
    'MCP_SERVER: answered MCP initialize. AUTH_REQUIRED: answered 401 or 403. NOT_MCP: answered, but not MCP. UNREACHABLE: no answer within 10 seconds. REFUSED: the network rules stopped the request (REQ-CONN-063).',
});

export const CredentialsStatus = {
  OK: 'OK',
  REFUSED_CREDENTIALS: 'REFUSED_CREDENTIALS',
  NOT_MCP: 'NOT_MCP',
  UNREACHABLE: 'UNREACHABLE',
  REFUSED: 'REFUSED',
} as const;
export type CredentialsStatus =
  (typeof CredentialsStatus)[keyof typeof CredentialsStatus];

registerEnumType(CredentialsStatus, {
  name: 'CredentialsStatus',
  description:
    'OK: connected and listed the tools. REFUSED_CREDENTIALS: the server answered 401 or 403. The other values mean the same as in ProbeStatus.',
});

@ObjectType('ProbeResult', {
  description: 'What a server shows without credentials (REQ-CONN-060).',
})
export class ProbeResultModel {
  @Field(() => ProbeStatus)
  status: ProbeStatus;

  @Field({ description: 'Why the probe ended as it did, for the user.' })
  message: string;

  @Field()
  authRequired: boolean;

  @Field({ description: 'Whether the server publishes OAuth metadata.' })
  oauth: boolean;

  @Field({
    description:
      'Whether its authorization server offers dynamic client registration.',
  })
  oauthDcr: boolean;

  @Field(() => AuthType, {
    nullable: true,
    description: 'The auth type for the add dialog to pre-fill (REQ-CONN-061).',
  })
  suggestedAuthType: AuthType | null;

  @Field(() => String, { nullable: true })
  serverName: string | null;

  @Field(() => String, { nullable: true })
  serverTitle: string | null;

  @Field(() => String, { nullable: true })
  serverVersion: string | null;

  @Field(() => String, { nullable: true })
  serverDescription: string | null;

  @Field(() => [String], {
    description: "The http(s) URLs of the server's own icons. Not fetched.",
  })
  iconUrls: string[];
}

@ObjectType('CredentialsCheck', {
  description: 'The result of connecting with credentials (REQ-CONN-062).',
})
export class CredentialsCheckModel {
  @Field(() => CredentialsStatus)
  status: CredentialsStatus;

  @Field()
  message: string;

  @Field(() => Int, { nullable: true })
  toolCount: number | null;

  @Field(() => [String], { description: 'The first five tool names.' })
  toolNames: string[];
}
