import { Badge } from "#/components/ui/badge"
import type { ConnectionStatus } from "#/gql/graphql"

const LABELS: Record<Exclude<ConnectionStatus, "OFF">, string> = {
  CONNECTING: "Connecting",
  CONNECTED: "Connected",
  FAILED: "Unreachable",
  REFUSED_CREDENTIALS: "Credentials refused",
}

// The live state of a connection's upstream client. OFF shows nothing: the
// enabled and credentials badges already say why there is no client. The
// wrapper is a polite live region, so a screen reader hears the change.
export function ConnectionStatusBadge({
  status,
}: {
  status: ConnectionStatus
}) {
  return (
    <span aria-live="polite" className="contents">
      {status !== "OFF" && (
        <Badge
          variant={
            status === "FAILED" || status === "REFUSED_CREDENTIALS"
              ? "destructive"
              : "secondary"
          }
        >
          {LABELS[status]}
        </Badge>
      )}
    </span>
  )
}
