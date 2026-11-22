import { useMutation } from "@apollo/client/react"
import {
  ConnectionsDocument,
  CreateConnectionDocument,
  type CreateConnectionInput,
} from "#/gql/graphql"

// Adds a custom server. The list of connections is fetched again before the
// promise resolves, so the new server shows at once.
export function useCreateConnection() {
  const [mutate, { loading }] = useMutation(CreateConnectionDocument, {
    refetchQueries: [ConnectionsDocument],
    awaitRefetchQueries: true,
  })
  const create = (input: CreateConnectionInput) =>
    mutate({ variables: { input } })
  return { create, loading }
}
