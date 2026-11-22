import type { AuthType } from "#/gql/graphql"

// The names the add dialog uses for each auth type (REQ-CONN-081).
export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  NONE: "No authentication",
  API_KEY: "API key",
  OAUTH_DCR: "DCR OAuth",
  OAUTH_MANUAL: "OAuth with client details",
}

// One line on what each auth type asks of the user, for the choice of an
// auth option.
export const AUTH_TYPE_HINTS: Record<AuthType, string> = {
  NONE: "The server needs no credentials.",
  API_KEY: "You paste a key or token from the provider.",
  OAUTH_DCR: "You sign in with the provider. OneDoor registers itself.",
  OAUTH_MANUAL: "You sign in with the provider, with client details you enter.",
}
