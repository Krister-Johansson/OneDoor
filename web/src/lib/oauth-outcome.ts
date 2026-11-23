// Where the OAuth callback sends the browser back, as `?oauth=` on the
// servers screen or a server's page (T21).
export const OAUTH_OUTCOMES = [
  "authorized",
  "denied",
  "failed",
  "expired",
] as const
export type OAuthOutcome = (typeof OAUTH_OUTCOMES)[number]

// The search params of a screen the callback can land on. Anything else in
// `oauth` is dropped.
export function oauthSearch(search: Record<string, unknown>): {
  oauth?: OAuthOutcome
} {
  const value = search.oauth
  return OAUTH_OUTCOMES.includes(value as OAuthOutcome)
    ? { oauth: value as OAuthOutcome }
    : {}
}
