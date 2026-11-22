import { useEffect, useState } from "react"
import { Button } from "#/components/ui/button"
import type { ConnectionStatus } from "#/gql/graphql"
import { useConnectionToolSyncs } from "#/hooks/use-connection-tool-syncs"
import { useResyncTools } from "#/hooks/use-resync-tools"
import { errorCode } from "#/lib/graphql-error"

// A sync job tries 3 times, each with a 30 second limit on listing the
// tools, so it ends within this time.
const SYNC_WAIT_MS = 120_000

interface ResyncToolsButtonProps {
  connection: { id: string; status: ConnectionStatus }
  serverName: string
  // Called with null when a re-sync starts and with a message when it fails.
  onError: (message: string | null) => void
}

// Queues a sync of the connection's tools and shows "Syncing" until it
// finishes. A sync needs a connected client, so the button shows only while
// the connection is connected.
export function ResyncToolsButton({
  connection,
  serverName,
  onError,
}: ResyncToolsButtonProps) {
  const { resync, loading } = useResyncTools()
  const [waiting, setWaiting] = useState(false)
  const connected = connection.status === "CONNECTED"

  useConnectionToolSyncs((id) => {
    if (id === connection.id) setWaiting(false)
  })

  // A sync that never reports back, or a client that disconnects, ends the
  // wait too.
  useEffect(() => {
    if (!waiting) return
    if (!connected) {
      setWaiting(false)
      return
    }
    const timer = setTimeout(() => setWaiting(false), SYNC_WAIT_MS)
    return () => clearTimeout(timer)
  }, [waiting, connected])

  async function start() {
    onError(null)
    setWaiting(true)
    try {
      await resync(connection.id)
    } catch (caught) {
      setWaiting(false)
      onError(resyncErrorMessage(caught, serverName))
    }
  }

  if (!connected) return null
  const busy = loading || waiting
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={busy}
      onClick={() => void start()}
    >
      {busy ? "Syncing tools…" : "Re-sync tools"}
    </Button>
  )
}

function resyncErrorMessage(error: unknown, name: string) {
  switch (errorCode(error)) {
    case "UPSTREAM_UNAVAILABLE":
      return `${name} is not connected, so its tools cannot be synced.`
    case "NOT_FOUND":
      return "This server no longer exists."
    default:
      return `Could not re-sync the tools of ${name}. Try again.`
  }
}
