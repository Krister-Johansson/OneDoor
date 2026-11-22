import { InternalError } from '../errors/domain-errors.js';
import type {
  CatalogAuthOption,
  CatalogEntry,
  Connection,
} from '../generated/prisma/client.js';
import { AuthType } from '../generated/prisma/enums.js';
import { iconPath } from '../icons/icons.service.js';
import { type ConnectionModel, SetupState } from './connection.model.js';

// Every query that maps to ConnectionModel loads these relations.
export const CONNECTION_INCLUDE = {
  catalogEntry: true,
  catalogAuthOption: true,
} as const;

export type ConnectionRow = Connection & {
  catalogEntry: CatalogEntry | null;
  catalogAuthOption: CatalogAuthOption | null;
};

// REQ-CONN-044.
export function setupStateOf(
  authType: AuthType,
  hasApiKey: boolean,
): SetupState {
  switch (authType) {
    case AuthType.NONE:
      return SetupState.READY;
    case AuthType.API_KEY:
      return hasApiKey ? SetupState.READY : SetupState.NEEDS_CREDENTIALS;
    case AuthType.OAUTH_DCR:
    case AuthType.OAUTH_MANUAL:
      return SetupState.NEEDS_CREDENTIALS;
  }
}

// A catalog-based connection takes its display name and description from the
// entry, and its URL, auth type and header settings from the auth option
// (REQ-CONN-012). The check constraint connection_catalog_or_custom_check
// guarantees that each field has exactly one source.
export function toConnectionModel(row: ConnectionRow): ConnectionModel {
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
    setupState: setupStateOf(authType, hasApiKey),
    iconUrl: iconPath(
      row.catalogEntry ? row.catalogEntry.iconId : row.iconId,
      displayName,
    ),
    enabled: row.enabled,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
