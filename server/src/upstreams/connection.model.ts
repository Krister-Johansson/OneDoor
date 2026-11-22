import { Field, ID, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AuthType } from '../generated/prisma/enums.js';

// REQ-CONN-044. OAuth tokens are not stored yet, so OAuth connections stay
// NEEDS_CREDENTIALS until the OAuth flows exist.
export const SetupState = {
  NEEDS_CREDENTIALS: 'NEEDS_CREDENTIALS',
  READY: 'READY',
} as const;
export type SetupState = (typeof SetupState)[keyof typeof SetupState];

registerEnumType(SetupState, {
  name: 'SetupState',
  description:
    'Whether the credentials of a connection are complete (REQ-CONN-044).',
});

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

  @Field({
    description: 'Whether an API key is stored. The key is never returned.',
  })
  hasApiKey: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'The OAuth client id of a custom OAUTH_MANUAL connection.',
  })
  oauthClientId: string | null;

  @Field({
    description:
      'Whether an OAuth client secret is stored. The secret is never returned.',
  })
  hasClientSecret: boolean;

  @Field(() => SetupState)
  setupState: SetupState;

  @Field({
    description:
      "The icon's URL path on this server: a stored icon, or the generated letter icon (REQ-CONN-070).",
  })
  iconUrl: string;

  @Field({ description: 'Whether the gateway uses it (REQ-CONN-051).' })
  enabled: boolean;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
