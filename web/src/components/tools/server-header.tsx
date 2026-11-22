import { useState } from "react"
import { ConnectionStatusBadge } from "#/components/servers/connection-status-badge"
import { ResyncToolsButton } from "#/components/servers/resync-tools-button"
import { ToolCountBadge } from "#/components/servers/tool-count-badge"
import { Badge } from "#/components/ui/badge"
import { useConnectionTools } from "#/hooks/use-connection-tools"

// The page heading of the tools screen: the server's name, URL and live
// state, with the re-sync action.
export function ServerHeader({ connectionId }: { connectionId: string }) {
  const connection = useConnectionTools(connectionId)
  const [error, setError] = useState<string | null>(null)

  return (
    <header className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <img
          src={connection.iconUrl}
          alt=""
          className="size-10 shrink-0 rounded-md"
        />
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-bold">
            {connection.displayName}
          </h1>
          <p className="text-muted-foreground truncate text-sm">
            {connection.url}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
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
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
    </header>
  )
}
