import { useMutation } from "@apollo/client/react"
import {
  SetCatalogOAuthClientDocument,
  type SetCatalogOAuthClientInput,
} from "#/gql/graphql"

// Sets the OAuth app of a catalog entry (T22). The entry updates in the
// cache by id. The connections on the entry show the app too, so the
// active queries are fetched again before the promise resolves. The dialog
// opens from the catalog card and from a server's page, which have
// different queries active.
export function useSetCatalogOAuthClient() {
  const [mutate, { loading }] = useMutation(SetCatalogOAuthClientDocument, {
    refetchQueries: "active",
    awaitRefetchQueries: true,
  })
  const setOAuthClient = (
    catalogEntryId: string,
    input: SetCatalogOAuthClientInput,
  ) => mutate({ variables: { catalogEntryId, input } })
  return { setOAuthClient, loading }
}
