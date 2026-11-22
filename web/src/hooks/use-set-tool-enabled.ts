import { useMutation } from "@apollo/client/react"
import { SetToolEnabledDocument } from "#/gql/graphql"

// Enables or disables a tool. The result carries the tool's id, so Apollo
// updates it in the cache without fetching again.
export function useSetToolEnabled() {
  const [mutate, { loading }] = useMutation(SetToolEnabledDocument)
  const setEnabled = (id: string, enabled: boolean) =>
    mutate({ variables: { id, enabled } })
  return { setEnabled, loading }
}
