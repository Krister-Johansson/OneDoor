import { Badge } from "#/components/ui/badge"

// How many tools the last sync stored. The wrapper is a polite live region,
// so a screen reader hears the new count.
export function ToolCountBadge({ toolCount }: { toolCount: number }) {
  return (
    <span aria-live="polite" className="contents">
      <Badge variant="outline">
        {toolCount === 1 ? "1 tool" : `${toolCount} tools`}
      </Badge>
    </span>
  )
}
