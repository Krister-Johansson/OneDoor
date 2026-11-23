import { useSuspenseQuery } from "@apollo/client/react"
import { OAuthRedirectUrlDocument } from "#/gql/graphql"

// The redirect URI to register in an OAuth app. Suspends until it is there.
export function useOAuthRedirectUrl() {
  return useSuspenseQuery(OAuthRedirectUrlDocument).data.oauthRedirectUrl
}
