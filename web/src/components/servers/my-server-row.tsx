import { Link } from "@tanstack/react-router"
import { useState } from "react"
import { Badge } from "#/components/ui/badge"
import { Button, buttonVariants } from "#/components/ui/button"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "#/components/ui/item"
import type { ConnectionsQuery } from "#/gql/graphql"
import { useRemoveConnection } from "#/hooks/use-remove-connection"
import { AUTH_TYPE_LABELS } from "#/lib/auth-type"
import { errorCode } from "#/lib/graphql-error"
import { ConnectionStatusBadge } from "./connection-status-badge"
import { EditServerDialog } from "./edit-server-dialog"
import { RemoveServerDialog } from "./remove-server-dialog"
import { ResyncToolsButton } from "./resync-tools-button"
import { ToolCountBadge } from "./tool-count-badge"

type Connection = ConnectionsQuery["connections"][number]

// One custom server with its edit and remove actions (REQ-CONN-080).
export function MyServerRow({ connection }: { connection: Connection }) {
  const { remove, loading: removing } = useRemoveConnection()
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function confirmRemove() {
    setError(null)
    try {
      await remove(connection.id)
    } catch (caught) {
      setConfirming(false)
      setError(
        errorCode(caught) === "NOT_FOUND"
          ? "This server no longer exists."
          : `Could not remove ${connection.displayName}. Try again.`,
      )
    }
  }

  return (
    <Item variant="outline" render={<li />}>
      <ItemMedia variant="image">
        <img src={connection.iconUrl} alt="" />
      </ItemMedia>
      <ItemContent>
        <ItemTitle>{connection.displayName}</ItemTitle>
        <ItemDescription>{connection.url}</ItemDescription>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </ItemContent>
      <ItemActions className="flex-wrap">
        <Badge variant="secondary">
          {AUTH_TYPE_LABELS[connection.authType]}
        </Badge>
        {connection.setupState === "NEEDS_CREDENTIALS" && (
          <Badge variant="outline">Needs credentials</Badge>
        )}
        <Badge variant={connection.enabled ? "default" : "outline"}>
          {connection.enabled ? "Enabled" : "Disabled"}
        </Badge>
        <ConnectionStatusBadge status={connection.status} />
        <ToolCountBadge connection={connection} />
        <ResyncToolsButton
          connection={connection}
          serverName={connection.displayName}
          onError={setError}
        />
        <Link
          to="/servers/$connectionId"
          params={{ connectionId: connection.id }}
          className={buttonVariants({ variant: "outline", size: "sm" })}
        >
          Tools
        </Link>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
          Remove
        </Button>
      </ItemActions>
      <EditServerDialog
        connection={connection}
        open={editing}
        onOpenChange={setEditing}
      />
      <RemoveServerDialog
        open={confirming}
        onOpenChange={setConfirming}
        serverName={connection.displayName}
        removing={removing}
        onConfirm={() => void confirmRemove()}
      />
    </Item>
  )
}
