import { useState } from "react"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemTitle,
} from "#/components/ui/item"
import { Switch } from "#/components/ui/switch"
import type { ConnectionToolsQuery } from "#/gql/graphql"
import { useSetToolEnabled } from "#/hooks/use-set-tool-enabled"
import { errorCode } from "#/lib/graphql-error"
import { ToolAnnotationBadges } from "./tool-annotation-badges"

type Tool = ConnectionToolsQuery["connection"]["tools"][number]

// One tool with its switch (T19).
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
    <Item variant="outline" render={<li />}>
      <ItemContent>
        <ItemTitle>
          <span className="font-mono">{tool.name}</span>
          {tool.title && (
            <span className="text-muted-foreground font-normal">
              {tool.title}
            </span>
          )}
        </ItemTitle>
        {tool.description && (
          <ItemDescription>{tool.description}</ItemDescription>
        )}
        <div className="flex flex-wrap gap-1.5">
          <ToolAnnotationBadges annotations={tool.annotations} />
        </div>
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </ItemContent>
      <ItemActions>
        <Switch
          checked={tool.enabled}
          disabled={loading}
          onCheckedChange={(checked) => void onCheckedChange(checked)}
          aria-label={`Use ${tool.name}`}
        />
      </ItemActions>
    </Item>
  )
}
