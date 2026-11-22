// Who a GraphQL or MCP request acts for. Until sign-in exists, every request
// acts as the seeded user `me` (specs/connections.md, REQ-CONN-001).
export const DEFAULT_USER_NAME = 'me';

export interface Caller {
  userId: string;
}

// The request object, with the caller that CallerGuard attaches.
export interface CallerRequest {
  caller?: Caller;
}
