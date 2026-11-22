import { useMutation } from "@apollo/client/react"
import { ResyncToolsDocument } from "#/gql/graphql"

// Queues a sync of a connection's tools. It returns once the sync is
// queued; useConnectionToolSyncs reports when it finishes.
export function useResyncTools() {
  const [mutate, { loading }] = useMutation(ResyncToolsDocument)
  const resync = (id: string) => mutate({ variables: { id } })
  return { resync, loading }
}
