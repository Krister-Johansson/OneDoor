import { useMutation } from "@apollo/client/react"
import { ProbeServerDocument } from "#/gql/graphql"

// Checks a server URL without credentials. Stores nothing.
export function useProbeServer() {
  const [mutate, { loading }] = useMutation(ProbeServerDocument)
  const probe = async (url: string) =>
    (await mutate({ variables: { url } })).data?.probeServer
  return { probe, loading }
}
