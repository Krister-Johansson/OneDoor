import { WrenchIcon } from "lucide-react"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty"
import { ItemGroup } from "#/components/ui/item"
import { useConnectionTools } from "#/hooks/use-connection-tools"
import { ToolRow } from "./tool-row"

// The tools of one connection, by name, each with its switch (T19).
export function ToolsSection({ connectionId }: { connectionId: string }) {
  const { tools } = useConnectionTools(connectionId)

  return (
    <section aria-labelledby="tools-heading" className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 id="tools-heading" className="text-lg font-semibold">
          Tools
        </h2>
        <p className="text-muted-foreground text-sm">
          Agents can search and run only enabled tools. The labels come from the
          server and are hints, not rules.
        </p>
      </div>
      {tools.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <WrenchIcon />
            </EmptyMedia>
            <EmptyTitle>No tools yet</EmptyTitle>
            <EmptyDescription>
              The tools appear after the first sync with the server.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      ) : (
        <ItemGroup>
          {tools.map((tool) => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
        </ItemGroup>
      )}
    </section>
  )
}
