import { useMutation } from "@apollo/client/react"
import {
  UpdateConnectionDocument,
  type UpdateConnectionInput,
} from "#/gql/graphql"

// Changes a custom server. The result carries the connection's id and every
// listed field, so Apollo updates it in the cache without fetching again.
export function useUpdateConnection() {
  const [mutate, { loading }] = useMutation(UpdateConnectionDocument)
  const update = (id: string, input: UpdateConnectionInput) =>
    mutate({ variables: { id, input } })
  return { update, loading }
}
