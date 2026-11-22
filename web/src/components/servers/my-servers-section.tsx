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
import { ItemGroup } from "#/components/ui/item"
import { useConnections } from "#/hooks/use-connections"
import { AddServerDialog } from "./add-server-dialog"
import { MyServerRow } from "./my-server-row"

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
        <ItemGroup>
          {custom.map((connection) => (
            <MyServerRow key={connection.id} connection={connection} />
          ))}
        </ItemGroup>
      )}
      <AddServerDialog open={adding} onOpenChange={setAdding} />
    </section>
  )
}
