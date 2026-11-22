import type { AuthType } from "#/gql/graphql"

// The names the add dialog uses for each auth type (REQ-CONN-081).
export const AUTH_TYPE_LABELS: Record<AuthType, string> = {
  NONE: "No authentication",
  API_KEY: "API key",
  OAUTH_DCR: "DCR OAuth",
  OAUTH_MANUAL: "OAuth with client details",
}
