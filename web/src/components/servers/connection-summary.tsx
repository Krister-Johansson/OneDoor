import { Check } from "lucide-react"
import type { ConnectionStatus, SetupState } from "#/gql/graphql"

interface ConnectionSummaryProps {
  connection: {
    enabled: boolean
    setupState: SetupState
    status: ConnectionStatus
  }
}

// One short state for a server card: whether OneDoor can use the server now,
// and if not, why. The server page shows the details. The wrapper is a
// polite live region, so a screen reader hears the change.
export function ConnectionSummary({ connection }: ConnectionSummaryProps) {
  return (
    <span aria-live="polite" className="shrink-0 text-sm">
      <SummaryText connection={connection} />
    </span>
  )
}

function SummaryText({ connection }: ConnectionSummaryProps) {
  if (!connection.enabled) {
    return <span className="text-muted-foreground">Off</span>
  }
  if (connection.setupState === "NEEDS_CREDENTIALS") {
    return <span className="text-muted-foreground">Needs credentials</span>
  }
  switch (connection.status) {
    case "CONNECTED":
      return (
        <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400">
          <Check className="size-4" aria-hidden />
          Active
        </span>
      )
    case "CONNECTING":
      return <span className="text-muted-foreground">Connecting</span>
    case "FAILED":
      return <span className="text-destructive">Unreachable</span>
    case "REFUSED_CREDENTIALS":
      return <span className="text-destructive">Credentials refused</span>
    case "OFF":
      return <span className="text-muted-foreground">Off</span>
  }
}
