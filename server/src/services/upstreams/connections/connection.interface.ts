import type { AuthType } from '../../../generated/prisma/enums.js';

// REQ-CONN-044. OAuth tokens are not stored yet, so OAuth connections stay
// NEEDS_CREDENTIALS until the OAuth flows exist.
export const SetupState = {
  NEEDS_CREDENTIALS: 'NEEDS_CREDENTIALS',
  READY: 'READY',
} as const;
export type SetupState = (typeof SetupState)[keyof typeof SetupState];

// A user's link to one MCP server. Secrets are never part of it: only
// whether they are set.
export interface Connection {
  id: string;
  catalogEntryId: string | null;
  displayName: string;
  description: string;
  url: string;
  authType: AuthType;
  headerName: string | null;
  headerPrefix: string | null;
  hasApiKey: boolean;
  oauthClientId: string | null;
  hasClientSecret: boolean;
  setupState: SetupState;
  iconUrl: string;
  enabled: boolean;
  // How many tools the last tool sync stored.
  toolCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// A custom server to add (REQ-CONN-020). The API layer validates the fields.
export interface CreateConnectionData {
  displayName: string;
  description?: string | null;
  url: string;
  authType: AuthType;
  apiKey?: string | null;
  headerName?: string | null;
  headerPrefix?: string | null;
  oauthClientId?: string | null;
  oauthClientSecret?: string | null;
}

// Changes to a connection (REQ-CONN-023). A field left out keeps its value;
// for apiKey, oauthClientSecret and description, null deletes it.
export interface UpdateConnectionData {
  displayName?: string;
  description?: string | null;
  url?: string;
  authType?: AuthType;
  apiKey?: string | null;
  headerName?: string;
  headerPrefix?: string;
  oauthClientId?: string;
  oauthClientSecret?: string | null;
}
