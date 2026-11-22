import { useMutation } from "@apollo/client/react"
import {
  type AuthType,
  CatalogDocument,
  ConnectionsDocument,
  SwitchOnCatalogEntryDocument,
} from "#/gql/graphql"

// Switches on a catalog entry with one of its auth options. The entry may
// get a new connection, so the catalog and the connections are fetched
// again before the promise resolves.
export function useSwitchOnCatalogEntry() {
  const [mutate, { loading }] = useMutation(SwitchOnCatalogEntryDocument, {
    refetchQueries: [CatalogDocument, ConnectionsDocument],
    awaitRefetchQueries: true,
  })
  const switchOn = (catalogEntryId: string, authType: AuthType) =>
    mutate({ variables: { catalogEntryId, authType } })
  return { switchOn, loading }
}
