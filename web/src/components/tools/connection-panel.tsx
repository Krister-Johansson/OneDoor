import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { ConnectionStatusBadge } from "#/components/servers/connection-status-badge"
import { EditServerDialog } from "#/components/servers/edit-server-dialog"
import { RemoveServerDialog } from "#/components/servers/remove-server-dialog"
import { ResyncToolsButton } from "#/components/servers/resync-tools-button"
import { ToolCountBadge } from "#/components/servers/tool-count-badge"
import { Button } from "#/components/ui/button"
import { Switch } from "#/components/ui/switch"
import { useConnectionTools } from "#/hooks/use-connection-tools"
import { useConnections } from "#/hooks/use-connections"
import { useRemoveConnection } from "#/hooks/use-remove-connection"
import { useSetConnectionEnabled } from "#/hooks/use-set-connection-enabled"
import { AUTH_TYPE_LABELS } from "#/lib/auth-type"
import { errorCode } from "#/lib/graphql-error"

// The connection to one server: its live state, how OneDoor signs in, and
// the switch, edit and remove actions (REQ-CONN-080, REQ-CONN-051,
// REQ-CONN-052).
export function ConnectionPanel({ connectionId }: { connectionId: string }) {
  const connection = useConnectionTools(connectionId)
  // The edit form needs the settings the connections list carries.
  const listed = useConnections().find((c) => c.id === connectionId)
  const { setEnabled, loading: switching } = useSetConnectionEnabled()
  const { remove, loading: removing } = useRemoveConnection()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const name = connection.displayName
  const custom = connection.catalogEntryId === null

  async function onCheckedChange(enabled: boolean) {
    setError(null)
    try {
      await setEnabled(connectionId, enabled)
    } catch (caught) {
      setError(
        errorCode(caught) === "NOT_FOUND"
          ? "This server no longer exists."
          : `Could not turn ${name} ${enabled ? "on" : "off"}. Try again.`,
      )
    }
  }

  async function confirmRemove() {
    setError(null)
    try {
      await remove(connectionId)
      await navigate({ to: "/servers" })
    } catch (caught) {
      setConfirming(false)
      setError(
        errorCode(caught) === "NOT_FOUND"
          ? "This server no longer exists."
          : `Could not remove ${name}. Try again.`,
      )
    }
  }

  return (
    <section
      aria-labelledby="connection-heading"
      className="flex flex-col gap-3"
    >
      <h2 id="connection-heading" className="text-lg font-semibold">
        Connection
      </h2>
      <div className="bg-card divide-y rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">Use this server</span>
            <span className="text-muted-foreground text-sm">
              {connection.enabled
                ? "Agents can find and run its enabled tools."
                : "Off: agents cannot find or run its tools."}
            </span>
          </div>
          <Switch
            checked={connection.enabled}
            disabled={switching}
            onCheckedChange={(checked) => void onCheckedChange(checked)}
            aria-label={`Use ${name}`}
          />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-muted-foreground text-sm">
              {AUTH_TYPE_LABELS[connection.authType]}
              {connection.setupState === "NEEDS_CREDENTIALS" &&
                " · Needs credentials"}
            </span>
            <ConnectionStatusBadge status={connection.status} />
            <ToolCountBadge connection={connection} />
          </div>
          <ResyncToolsButton
            connection={connection}
            serverName={name}
            onError={setError}
          />
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 p-4">
          {custom && listed && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setEditing(true)}
            >
              Edit
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => setConfirming(true)}
          >
            Remove
          </Button>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      {custom && listed && (
        <EditServerDialog
          connection={listed}
          open={editing}
          onOpenChange={setEditing}
        />
      )}
      <RemoveServerDialog
        open={confirming}
        onOpenChange={setConfirming}
        serverName={name}
        removing={removing}
        onConfirm={() => void confirmRemove()}
      />
    </section>
  )
}
