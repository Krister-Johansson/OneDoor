import { useSuspenseQuery } from "@apollo/client/react"
import { ViewerDocument } from "#/gql/graphql"

// The user the app acts for. Suspends until the data is there.
export function useViewer() {
  return useSuspenseQuery(ViewerDocument).data.viewer
}
