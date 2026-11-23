import type { EncryptedSecret } from '../../../crypto/secret-store.js';
import type { AuthType } from '../../../generated/prisma/enums.js';

// What a provider needs to know about a connection. The header settings
// are the effective ones: a catalog-based connection takes them from its
// auth option.
export interface UpstreamAuthTarget {
  connectionId: string;
  authType: AuthType;
  headerName: string | null;
  headerPrefix: string | null;
  // The stored, encrypted API key, or null when none is stored.
  apiKey: EncryptedSecret | null;
}

// How a client authenticates to the upstream server. Holds a plaintext
// secret: keep it in memory, never log it or return it.
export interface UpstreamAuth {
  // Sent with every request of the client.
  headers: Record<string, string>;
  // Header names the guarded fetch drops when a redirect leaves the origin.
  sensitiveHeaders: string[];
}
