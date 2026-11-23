import { useApolloClient, useSuspenseQuery } from "@apollo/client/react"
import { ConnectionToolsDocument } from "#/gql/graphql"
import { useConnectionToolSyncs } from "./use-connection-tool-syncs"

// One connection with its tools, by name. Suspends until the data is there.
// A finished sync can add or remove tools, so the list is fetched again
// when this connection's sync ends. The client refetches it, not the hook:
// the new result reaches every reader through the cache, and the page never
// suspends again (several components read this query at once).
export function useConnectionTools(connectionId: string) {
  const client = useApolloClient()
  const { data } = useSuspenseQuery(ConnectionToolsDocument, {
    variables: { id: connectionId },
  })
  useConnectionToolSyncs((id) => {
    if (id === connectionId) {
      void client.refetchQueries({ include: [ConnectionToolsDocument] })
    }
  })
  return data.connection
}
