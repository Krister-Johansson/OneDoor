import { Badge } from "#/components/ui/badge"
import type { ConnectionStatus } from "#/gql/graphql"

// How many tools the last sync stored. It shows once the connection is
// connected or has stored tools, so a connection that never synced shows
// nothing. The wrapper is a polite live region, so a screen reader hears
// the new count.
export function ToolCountBadge({
  connection,
}: {
  connection: { status: ConnectionStatus; toolCount: number }
}) {
  const { status, toolCount } = connection
  return (
    <span aria-live="polite" className="contents">
      {(status === "CONNECTED" || toolCount > 0) && (
        <Badge variant="outline">
          {toolCount === 1 ? "1 tool" : `${toolCount} tools`}
        </Badge>
      )}
    </span>
  )
}
