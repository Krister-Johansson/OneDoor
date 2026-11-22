import { ServerIcon } from "lucide-react"
import { Badge } from "#/components/ui/badge"
import { Button } from "#/components/ui/button"
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "#/components/ui/item"
import { useConnections } from "#/hooks/use-connections"
import { AUTH_TYPE_LABELS } from "#/lib/auth-type"

// The caller's custom servers, sorted by display name (REQ-CONN-080).
export function MyServersSection() {
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
        {custom.length > 0 && <Button disabled>Add server</Button>}
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
            <Button disabled>Add server</Button>
          </EmptyContent>
        </Empty>
      ) : (
        <ItemGroup>
          {custom.map((connection) => (
            <Item key={connection.id} variant="outline" render={<li />}>
              <ItemMedia variant="image">
                <img src={connection.iconUrl} alt="" />
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{connection.displayName}</ItemTitle>
                <ItemDescription>{connection.url}</ItemDescription>
              </ItemContent>
              <ItemActions className="flex-wrap">
                <Badge variant="secondary">
                  {AUTH_TYPE_LABELS[connection.authType]}
                </Badge>
                <Badge variant={connection.enabled ? "default" : "outline"}>
                  {connection.enabled ? "Enabled" : "Disabled"}
                </Badge>
                <Button variant="outline" size="sm" disabled>
                  Edit
                </Button>
                <Button variant="outline" size="sm" disabled>
                  Remove
                </Button>
              </ItemActions>
            </Item>
          ))}
        </ItemGroup>
      )}
    </section>
  )
}
