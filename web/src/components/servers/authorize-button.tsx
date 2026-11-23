import { Button } from "#/components/ui/button"
import type { AuthType } from "#/gql/graphql"
import { useStartOAuthAuthorization } from "#/hooks/use-start-oauth-authorization"
import { errorCode } from "#/lib/graphql-error"

interface AuthorizeButtonProps {
  connection: {
    id: string
    authType: AuthType
    oauthAuthorized: boolean
    enabled: boolean
  }
  serverName: string
  // Called with null when an authorization starts and with a message when
  // it cannot start.
  onError: (message: string | null) => void
}

// Sends the browser to the server's authorization page (T21). It shows only
// for an enabled OAUTH_DCR connection without tokens; the callback brings
// the browser back with the outcome.
export function AuthorizeButton({
  connection,
  serverName,
  onError,
}: AuthorizeButtonProps) {
  const { start, loading } = useStartOAuthAuthorization()
  if (
    connection.authType !== "OAUTH_DCR" ||
    connection.oauthAuthorized ||
    !connection.enabled
  ) {
    return null
  }

  async function authorize() {
    onError(null)
    try {
      window.location.assign(await start(connection.id))
    } catch (caught) {
      onError(authorizeErrorMessage(caught, serverName))
    }
  }

  return (
    <Button size="sm" disabled={loading} onClick={() => void authorize()}>
      {loading ? "Opening…" : "Authorize"}
    </Button>
  )
}

function authorizeErrorMessage(error: unknown, name: string) {
  switch (errorCode(error)) {
    case "UPSTREAM_UNAVAILABLE":
      return `Could not reach the authorization server of ${name}. Try again later.`
    case "NOT_FOUND":
      return "This server no longer exists."
    default:
      return `Could not start the authorization of ${name}. Try again.`
  }
}
