import type {
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client';
import type { EncryptedSecret } from '../../../../crypto/secret-store.js';

// How long an authorization may take between startOAuthAuthorization and
// the callback.
export const OAUTH_FLOW_TTL_MS = 10 * 60_000;

// An authorization in progress, stored under its `state` until the callback
// takes it. The code verifier is a secret, so it is stored encrypted.
export interface PendingOAuthFlow {
  connectionId: string;
  ownerId: string;
  codeVerifier: EncryptedSecret;
}

// The stored OAuth state of a connection, decrypted. The client registration
// and the tokens are kept exactly as the MCP SDK returned them, including the
// issuer it stamps on them. Holds secrets: never log or return it.
export interface ConnectionOAuthState {
  client?: StoredOAuthClientInformation;
  tokens?: StoredOAuthTokens;
  discovery?: OAuthDiscoveryState;
}

// Where the callback sends the owner's browser, as a query value on the
// server's page in web.
export const OAuthOutcome = {
  AUTHORIZED: 'authorized',
  DENIED: 'denied',
  FAILED: 'failed',
  EXPIRED: 'expired',
} as const;
export type OAuthOutcome = (typeof OAuthOutcome)[keyof typeof OAuthOutcome];
