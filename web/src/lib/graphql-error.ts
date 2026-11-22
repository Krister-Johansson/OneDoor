import { CombinedGraphQLErrors } from "@apollo/client"

// The server's error code (extensions.code), such as CONFLICT, or undefined
// when the error did not come from the GraphQL response.
export function errorCode(error: unknown): string | undefined {
  if (!CombinedGraphQLErrors.is(error)) return undefined
  const code = error.errors[0]?.extensions?.code
  return typeof code === "string" ? code : undefined
}
