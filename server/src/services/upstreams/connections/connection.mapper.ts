import { InternalError } from '../../../errors/domain-errors.js';
// Prisma's row types, named apart from the service's own types.
import type {
  CatalogAuthOption as CatalogAuthOptionRecord,
  CatalogEntry as CatalogEntryRecord,
  Connection as ConnectionRecord,
} from '../../../generated/prisma/client.js';
import { AuthType } from '../../../generated/prisma/enums.js';
import { iconPath } from '../../icons/icons.service.js';
import { type Connection, SetupState } from './connection.interface.js';

// Every query that maps to Connection loads these relations.
export const CONNECTION_INCLUDE = {
  catalogEntry: true,
  catalogAuthOption: true,
  _count: { select: { tools: true } },
  // Only whether tokens exist; the tokens themselves stay in the table.
  oauth: { select: { tokensCiphertext: true, authorizedAt: true } },
} as const;

export type ConnectionRow = ConnectionRecord & {
  catalogEntry: CatalogEntryRecord | null;
  catalogAuthOption: CatalogAuthOptionRecord | null;
  _count: { tools: number };
  oauth: { tokensCiphertext: string | null; authorizedAt: Date | null } | null;
};

// REQ-CONN-044. OAUTH_MANUAL needs its client id (the OAuth app) and tokens.
export function setupStateOf(
  authType: AuthType,
  hasApiKey: boolean,
  oauthAuthorized: boolean,
  hasOAuthClient: boolean,
): SetupState {
  switch (authType) {
    case AuthType.NONE:
      return SetupState.READY;
    case AuthType.API_KEY:
      return hasApiKey ? SetupState.READY : SetupState.NEEDS_CREDENTIALS;
    case AuthType.OAUTH_DCR:
      return oauthAuthorized ? SetupState.READY : SetupState.NEEDS_CREDENTIALS;
    case AuthType.OAUTH_MANUAL:
      return hasOAuthClient && oauthAuthorized
        ? SetupState.READY
        : SetupState.NEEDS_CREDENTIALS;
  }
}

// A catalog-based connection takes its display name and description from the
// entry, and its URL, auth type and header settings from the auth option
// (REQ-CONN-012). The check constraint connection_catalog_or_custom_check
// guarantees that each field has exactly one source.
export function toConnection(row: ConnectionRow): Connection {
  const displayName = row.catalogEntry?.displayName ?? row.displayName;
  const settings = row.catalogAuthOption ?? row;
  const { url, authType } = settings;
  if (displayName === null || url === null || authType === null) {
    throw new InternalError({
      cause: new Error(
        `Connection ${row.id} has no display name, URL or auth type`,
      ),
    });
  }
  const hasApiKey = row.apiKeyCiphertext !== null;
  const oauthAuthorized = (row.oauth?.tokensCiphertext ?? null) !== null;
  return {
    id: row.id,
    catalogEntryId: row.catalogEntryId,
    displayName,
    description: row.catalogEntry?.description ?? row.description ?? '',
    url,
    authType,
    headerName: settings.headerName,
    headerPrefix: settings.headerPrefix,
    hasApiKey,
    oauthClientId: row.oauthClientId,
    hasClientSecret: row.oauthClientSecretCiphertext !== null,
    oauthAuthorized,
    setupState: setupStateOf(
      authType,
      hasApiKey,
      oauthAuthorized,
      row.oauthClientId !== null,
    ),
    iconUrl: iconPath(
      row.catalogEntry ? row.catalogEntry.iconId : row.iconId,
      displayName,
    ),
    enabled: row.enabled,
    toolCount: row._count.tools,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
