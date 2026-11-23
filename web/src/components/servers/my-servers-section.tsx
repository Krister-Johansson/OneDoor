import { ServerIcon } from "lucide-react"
import { useState } from "react"
import { Button } from "#/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty"
import { useConnections } from "#/hooks/use-connections"
import { AddServerDialog } from "./add-server-dialog"
import { ConnectionSummary } from "./connection-summary"
import { ServerCard } from "./server-card"
import { ToolCountText } from "./tool-count-text"

// The caller's custom servers, sorted by display name (REQ-CONN-080).
export function MyServersSection() {
  const [adding, setAdding] = useState(false)
  const custom = useConnections().filter(
    (connection) => connection.catalogEntryId === null,
  )

  return (
    <section
      aria-labelledby="my-servers-heading"
      className="flex flex-col gap-4"
    >
      <div className="flex items-center justify-between">
        <h2 id="my-servers-heading" className="text-lg font-semibold">
          My servers
        </h2>
        {custom.length > 0 && (
          <Button onClick={() => setAdding(true)}>Add server</Button>
        )}
      </div>
      {custom.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <ServerIcon />
            </EmptyMedia>
            <EmptyTitle>No servers yet</EmptyTitle>
            <EmptyDescription>
              Add an MCP server of your own by its URL.
            </EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            <Button onClick={() => setAdding(true)}>Add server</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {custom.map((connection) => (
            <ServerCard
              key={connection.id}
              name={connection.displayName}
              iconUrl={connection.iconUrl}
              fromCatalog={false}
              connectionId={connection.id}
              detail={<ToolCountText toolCount={connection.toolCount} />}
              aside={<ConnectionSummary connection={connection} />}
            />
          ))}
        </ul>
      )}
      <AddServerDialog open={adding} onOpenChange={setAdding} />
    </section>
  )
}
