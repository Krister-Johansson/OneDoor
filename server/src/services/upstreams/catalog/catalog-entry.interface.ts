import type { AuthType } from '../../../generated/prisma/enums.js';
import type { Connection } from '../connections/connection.interface.js';

// One way to connect to a catalog entry (REQ-CONN-010).
export interface CatalogAuthOption {
  authType: AuthType;
  url: string;
  headerName: string | null;
  headerPrefix: string | null;
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
