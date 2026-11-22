import { useMutation } from "@apollo/client/react"
import {
  CheckCredentialsDocument,
  type CheckCredentialsInput,
} from "#/gql/graphql"

// Connects with the entered credentials and lists the tools. Stores nothing.
export function useCheckCredentials() {
  const [mutate, { loading }] = useMutation(CheckCredentialsDocument)
  const check = async (input: CheckCredentialsInput) =>
    (await mutate({ variables: { input } })).data?.checkCredentials
  return { check, loading }
}
