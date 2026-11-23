import type { PendingOAuthFlow } from './oauth.interface.js';

// Holds authorizations in progress between the redirect to the authorization
// server and the callback (T21).
export abstract class OAuthFlowStore {
  // Identifies the implementation, for logs.
  abstract readonly id: string;

  // Stores the flow under `state` for `ttlMs`.
  abstract save(
    state: string,
    flow: PendingOAuthFlow,
    ttlMs: number,
  ): Promise<void>;

  // Returns the flow and deletes it, so a state works once. Null when the
  // state is unknown, used or expired.
  abstract take(state: string): Promise<PendingOAuthFlow | null>;
}
