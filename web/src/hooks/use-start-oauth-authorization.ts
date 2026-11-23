import { useMutation } from "@apollo/client/react"
import { StartOAuthAuthorizationDocument } from "#/gql/graphql"

// Starts the OAuth authorization of a connection and resolves with the URL
// to send the browser to.
export function useStartOAuthAuthorization() {
  const [mutate, { loading }] = useMutation(StartOAuthAuthorizationDocument)
  const start = async (id: string) => {
    const { data } = await mutate({ variables: { id } })
    if (!data) throw new Error("The server returned no authorization URL")
    return data.startOAuthAuthorization
  }
  return { start, loading }
}
