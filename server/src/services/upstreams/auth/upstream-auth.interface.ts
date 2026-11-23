import type { OAuthClientProvider } from '@modelcontextprotocol/client';
import type { EncryptedSecret } from '../../../crypto/secret-store.js';
import type { AuthType } from '../../../generated/prisma/enums.js';

// What a provider needs to know about a connection. The header settings
// are the effective ones: a catalog-based connection takes them from its
// auth option.
export interface UpstreamAuthTarget {
  connectionId: string;
  ownerId: string;
  authType: AuthType;
  headerName: string | null;
  headerPrefix: string | null;
  // The stored, encrypted API key, or null when none is stored.
  apiKey: EncryptedSecret | null;
  // When the owner last completed an OAuth authorization, or null.
  oauthAuthorizedAt: Date | null;
  // The OAuth app of an OAUTH_MANUAL connection, as stored: its own, or
  // its catalog auth option's.
  oauthClientId: string | null;
  oauthClientSecret: EncryptedSecret | null;
}

// What the registry tells a provider while its client runs.
export interface UpstreamAuthHooks {
  // The stored credentials stopped working and were deleted, so the
  // connection needs its owner again.
  credentialsLost(): void;
}

// How a client authenticates to the upstream server. Holds a plaintext
// secret: keep it in memory, never log it or return it.
export interface UpstreamAuth {
  // Sent with every request of the client.
  headers: Record<string, string>;
  // Header names the guarded fetch drops when a redirect leaves the origin.
  sensitiveHeaders: string[];
  // For OAuth: the SDK reads and refreshes the tokens through it.
  authProvider?: OAuthClientProvider;
}
