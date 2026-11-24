import { useMutation } from "@apollo/client/react"
import {
  ConnectionsDocument,
  ConnectionToolsDocument,
  SetCatalogOAuthClientDocument,
  type SetCatalogOAuthClientInput,
} from "#/gql/graphql"

// Sets the OAuth app of a catalog entry (T22). The entry updates in the
// cache by id. The connections on the entry show the app too, so the
// connection queries are fetched again before the promise resolves.
export function useSetCatalogOAuthClient() {
  const [mutate, { loading }] = useMutation(SetCatalogOAuthClientDocument, {
    refetchQueries: [ConnectionsDocument, ConnectionToolsDocument],
    awaitRefetchQueries: true,
  })
  const setOAuthClient = (
    catalogEntryId: string,
    input: SetCatalogOAuthClientInput,
  ) => mutate({ variables: { catalogEntryId, input } })
  return { setOAuthClient, loading }
}
