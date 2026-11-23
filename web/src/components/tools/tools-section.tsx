import { Search, WrenchIcon } from "lucide-react"
import { useState } from "react"
import { Accordion } from "#/components/ui/accordion"
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "#/components/ui/empty"
import { Input } from "#/components/ui/input"
import { useConnectionTools } from "#/hooks/use-connection-tools"
import { ToolRow } from "./tool-row"

// The tools of one connection, by name, each with its switch (T19). The
// search matches the name, title and description.
export function ToolsSection({ connectionId }: { connectionId: string }) {
  const { tools } = useConnectionTools(connectionId)
  const [query, setQuery] = useState("")
  const needle = query.trim().toLowerCase()
  const shown = needle
    ? tools.filter((tool) =>
        [tool.name, tool.title ?? "", tool.description].some((text) =>
          text.toLowerCase().includes(needle),
        ),
      )
    : tools

  return (
    <section aria-labelledby="tools-heading" className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-1">
          <h2 id="tools-heading" className="text-lg font-semibold">
            Tools
          </h2>
          <p className="text-muted-foreground text-sm">
            Agents can search and run only enabled tools. The labels come from
            the server and are hints, not rules.
          </p>
        </div>
        {tools.length > 0 && (
          <div className="relative sm:w-64">
            <Search
              className="text-muted-foreground absolute top-1/2 left-2.5 size-4 -translate-y-1/2"
              aria-hidden
            />
            <Input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search tools"
              aria-label="Search tools"
              className="pl-8"
            />
          </div>
        )}
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
      ) : shown.length === 0 ? (
        <p className="text-muted-foreground text-sm">
          No tool matches "{query.trim()}".
        </p>
      ) : (
        <Accordion multiple className="bg-card rounded-lg border">
          {shown.map((tool) => (
            <ToolRow key={tool.id} tool={tool} />
          ))}
        </Accordion>
      )}
    </section>
  )
}
