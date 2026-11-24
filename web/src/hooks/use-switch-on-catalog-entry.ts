import { useMutation } from "@apollo/client/react"
import {
  type AuthType,
  CatalogDocument,
  ConnectionsDocument,
  SwitchOnCatalogEntryDocument,
  type UrlParameterInput,
} from "#/gql/graphql"

// Switches on a catalog entry with one of its auth options. The entry may
// get a new connection, so the catalog and the connections are fetched
// again before the promise resolves.
export function useSwitchOnCatalogEntry() {
  const [mutate, { loading }] = useMutation(SwitchOnCatalogEntryDocument, {
    refetchQueries: [CatalogDocument, ConnectionsDocument],
    awaitRefetchQueries: true,
  })
  // `urlParameters` fills the placeholders of the option's URL (T22). Left
  // out, the connection keeps its stored values.
  const switchOn = (
    catalogEntryId: string,
    authType: AuthType,
    urlParameters?: UrlParameterInput[],
  ) => mutate({ variables: { catalogEntryId, authType, urlParameters } })
  return { switchOn, loading }
}
