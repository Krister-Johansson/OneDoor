import { useSuspenseQuery } from "@apollo/client/react"
import { ConnectionsDocument } from "#/gql/graphql"

// The caller's connections, sorted by display name. Suspends until the data
// is there.
export function useConnections() {
  return useSuspenseQuery(ConnectionsDocument).data.connections
}
