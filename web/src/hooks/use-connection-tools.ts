import { useSuspenseQuery } from "@apollo/client/react"
import { ConnectionToolsDocument } from "#/gql/graphql"
import { useConnectionToolSyncs } from "./use-connection-tool-syncs"

// One connection with its tools, by name. Suspends until the data is there.
// A finished sync can add or remove tools, so the list is fetched again
// when this connection's sync ends.
export function useConnectionTools(connectionId: string) {
  const { data, refetch } = useSuspenseQuery(ConnectionToolsDocument, {
    variables: { id: connectionId },
  })
  useConnectionToolSyncs((id) => {
    if (id === connectionId) void refetch()
  })
  return data.connection
}
