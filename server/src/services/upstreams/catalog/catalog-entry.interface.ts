import type { AuthType } from '../../../generated/prisma/enums.js';
import type { Connection } from '../connections/connection.interface.js';

// One way to connect to a catalog entry (REQ-CONN-010).
export interface CatalogAuthOption {
  authType: AuthType;
  url: string;
  headerName: string | null;
  headerPrefix: string | null;
  // OAUTH_MANUAL only: the OAuth app every connection on the option uses
  // (T22). Null until it is set.
  oauthClientId: string | null;
  hasClientSecret: boolean;
}

// A pre-installed server, with the caller's connection if any (REQ-CONN-011).
export interface CatalogEntry {
  id: string;
  key: string;
  displayName: string;
  description: string;
  iconUrl: string;
  authOptions: CatalogAuthOption[];
  connection: Connection | null;
}

// The OAuth app of a catalog entry's OAUTH_MANUAL option (T22). The client
// secret follows the secret rule: left out keeps it, null deletes it, a
// string replaces it.
export interface SetCatalogOAuthClientData {
  clientId: string;
  clientSecret?: string | null;
}
