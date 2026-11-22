import { useSuspenseQuery } from "@apollo/client/react"
import { CatalogDocument } from "#/gql/graphql"

// Every catalog entry, sorted by display name, with the caller's connection.
// Suspends until the data is there.
export function useCatalog() {
  return useSuspenseQuery(CatalogDocument).data.catalog
}
