import { Field, ID, Int, ObjectType, registerEnumType } from '@nestjs/graphql';
import { AuthType } from '../../../../generated/prisma/enums.js';
import {
  type Connection,
  SetupState,
} from '../../../../services/upstreams/connections/connection.interface.js';
import { ConnectionStatus } from '../../../../services/upstreams/registry/connection-status.interface.js';

registerEnumType(SetupState, {
  name: 'SetupState',
  description:
    'Whether the credentials of a connection are complete (REQ-CONN-044).',
});

registerEnumType(ConnectionStatus, {
  name: 'ConnectionStatus',
  description:
    "The state of a connection's upstream client. OFF: no client is wanted (disabled, not READY, or an auth type without a client yet). FAILED: the last connect failed. REFUSED_CREDENTIALS: the server refused the credentials (401 or 403). FAILED and REFUSED_CREDENTIALS last until the next change to the connection.",
});

registerEnumType(AuthType, {
  name: 'AuthType',
  description: 'How OneDoor authenticates to an MCP server (REQ-CONN-040).',
});

@ObjectType('Connection', {
  description:
    "A user's link to one MCP server. A catalog-based connection shows its catalog entry's name, description, URL, auth type and header settings.",
})
export class ConnectionModel implements Connection {
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
    description:
      "The OAuth client id of an OAUTH_MANUAL connection: its own, or its catalog auth option's.",
  })
  oauthClientId: string | null;

  @Field({
    description:
      "Whether an OAuth client secret is stored, the connection's own or its catalog auth option's. The secret is never returned.",
  })
  hasClientSecret: boolean;

  @Field({
    description:
      'Whether OAuth tokens are stored (REQ-CONN-041). The tokens are never returned.',
  })
  oauthAuthorized: boolean;

  @Field(() => SetupState)
  setupState: SetupState;

  @Field({
    description:
      "The icon's URL path on this server: a stored icon, or the generated letter icon (REQ-CONN-070).",
  })
  iconUrl: string;

  @Field({ description: 'Whether the gateway uses it (REQ-CONN-051).' })
  enabled: boolean;

  @Field(() => Int, {
    description:
      'How many tools the last tool sync stored. A failed sync and a disabled connection keep them.',
  })
  toolCount: number;

  @Field()
  createdAt: Date;

  @Field()
  updatedAt: Date;
}
