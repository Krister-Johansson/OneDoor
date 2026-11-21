import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AuthType } from '../generated/prisma/enums.js';

registerEnumType(AuthType, {
  name: 'AuthType',
  description: 'How OneDoor authenticates to an MCP server (REQ-CONN-040).',
});

@ObjectType('Connection', {
  description:
    "A user's link to one MCP server. A catalog-based connection shows its catalog entry's name, description, URL, auth type and header settings.",
})
export class ConnectionModel {
  @Field(() => ID)
  id: string;

  @Field(() => ID, {
    nullable: true,
    description: 'Set when the connection is based on a catalog entry.',
  })
  catalogEntryId: string | null;

  @Field({ description: 'The server name agents see (REQ-CONN-021).' })
  displayName: string;

  @Field()
  description: string;

  @Field()
  url: string;

  @Field(() => AuthType)
  authType: AuthType;

  @Field(() => String, {
    nullable: true,
    description: 'The header that carries the API key. Only for API_KEY.',
  })
  headerName: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Text before the API key in the header. Only for API_KEY.',
  })
  headerPrefix: string | null;

  @Field({ description: 'Whether the gateway uses it (REQ-CONN-051).' })
  enabled: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
