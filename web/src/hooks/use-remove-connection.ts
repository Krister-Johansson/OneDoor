import { useMutation } from "@apollo/client/react"
import {
  CatalogDocument,
  ConnectionsDocument,
  RemoveConnectionDocument,
} from "#/gql/graphql"

// Removes a connection with its credentials. The connections and the catalog
// are fetched again before the promise resolves, so the server disappears
// from both at once.
export function useRemoveConnection() {
  const [mutate, { loading }] = useMutation(RemoveConnectionDocument, {
    refetchQueries: [ConnectionsDocument, CatalogDocument],
    awaitRefetchQueries: true,
  })
  const remove = (id: string) => mutate({ variables: { id } })
  return { remove, loading }
}
