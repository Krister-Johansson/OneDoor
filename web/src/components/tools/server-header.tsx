import { Link } from "@tanstack/react-router"
import { ChevronLeft } from "lucide-react"
import { useState } from "react"
import { AuthorizeButton } from "#/components/servers/authorize-button"
import { useConnectionTools } from "#/hooks/use-connection-tools"

// The top of a server's page: the way back, the server's icon, name,
// description and URL, and the action the server needs first (Authorize).
export function ServerHeader({ connectionId }: { connectionId: string }) {
  const connection = useConnectionTools(connectionId)
  const [error, setError] = useState<string | null>(null)

  return (
    <header className="flex flex-col gap-4">
      <Link
        to="/servers"
        aria-label="Back to servers"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1 text-sm"
      >
        <ChevronLeft className="size-4" aria-hidden />
        Servers
      </Link>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 items-start gap-4">
          <img
            src={connection.iconUrl}
            alt=""
            className="size-12 shrink-0 rounded-md"
          />
          <div className="flex min-w-0 flex-col gap-1">
            <h1 className="truncate text-2xl font-bold">
              {connection.displayName}
            </h1>
            {connection.description && (
              <p className="text-muted-foreground">{connection.description}</p>
            )}
            <p className="text-muted-foreground truncate text-sm">
              {connection.url}
            </p>
          </div>
        </div>
        <AuthorizeButton
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
