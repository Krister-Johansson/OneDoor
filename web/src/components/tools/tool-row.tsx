import { useState } from "react"
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "#/components/ui/accordion"
import { Switch } from "#/components/ui/switch"
import type { ConnectionToolsQuery } from "#/gql/graphql"
import { useSetToolEnabled } from "#/hooks/use-set-tool-enabled"
import { errorCode } from "#/lib/graphql-error"
import { ToolAnnotationBadges } from "./tool-annotation-badges"

type Tool = ConnectionToolsQuery["connection"]["tools"][number]

// One tool: its name and switch, and when opened its description and
// annotation hints (T19).
export function ToolRow({ tool }: { tool: Tool }) {
  const { setEnabled, loading } = useSetToolEnabled()
  const [error, setError] = useState<string | null>(null)

  async function onCheckedChange(enabled: boolean) {
    setError(null)
    try {
      await setEnabled(tool.id, enabled)
    } catch (caught) {
      setError(
        errorCode(caught) === "NOT_FOUND"
          ? "This tool no longer exists. Re-sync the tools to update the list."
          : `Could not ${enabled ? "enable" : "disable"} ${tool.name}. Try again.`,
      )
    }
  }

  return (
    <AccordionItem value={tool.id} className="px-4">
      {/* The accordion's heading element holds the trigger; it grows, so
          the chevron sits at the right, next to the switch. */}
      <div className="flex items-center gap-3 [&>h3]:min-w-0 [&>h3]:flex-1">
        <AccordionTrigger className="min-w-0 py-3 hover:no-underline">
          <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-mono">{tool.name}</span>
            {tool.title && (
              <span className="text-muted-foreground font-normal">
                {tool.title}
              </span>
            )}
          </span>
        </AccordionTrigger>
        <Switch
          checked={tool.enabled}
          disabled={loading}
          onCheckedChange={(checked) => void onCheckedChange(checked)}
          aria-label={`Use ${tool.name}`}
        />
      </div>
      <AccordionContent className="flex flex-col gap-2">
        <p className="text-muted-foreground">
          {tool.description || "The server gives no description."}
        </p>
        <div className="flex flex-wrap gap-1.5">
          <ToolAnnotationBadges annotations={tool.annotations} />
        </div>
      </AccordionContent>
      {error && (
        <p role="alert" className="text-destructive pb-3 text-sm">
          {error}
        </p>
      )}
    </AccordionItem>
  )
}
