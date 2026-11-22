import { useMutation } from "@apollo/client/react"
import { SetConnectionEnabledDocument } from "#/gql/graphql"

// Enables or disables a connection. The result carries the connection's id,
// so Apollo updates it in the cache without fetching again.
export function useSetConnectionEnabled() {
  const [mutate, { loading }] = useMutation(SetConnectionEnabledDocument)
  const setEnabled = (id: string, enabled: boolean) =>
    mutate({ variables: { id, enabled } })
  return { setEnabled, loading }
}
