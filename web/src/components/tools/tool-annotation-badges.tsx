import { Badge } from "#/components/ui/badge"
import type { ConnectionToolsQuery } from "#/gql/graphql"

type Annotations =
  ConnectionToolsQuery["connection"]["tools"][number]["annotations"]
type Hint = Exclude<keyof Annotations, "__typename">

const LABELS: [Hint, string][] = [
  ["readOnlyHint", "Read-only"],
  ["destructiveHint", "Destructive"],
  ["idempotentHint", "Idempotent"],
  ["openWorldHint", "Open world"],
]

// The hints the server set to true. They come from the server and may be
// wrong, so they are labels only.
export function ToolAnnotationBadges({
  annotations,
}: {
  annotations: Annotations
}) {
  return LABELS.filter(([hint]) => annotations[hint] === true).map(
    ([hint, label]) => (
      <Badge key={hint} variant="secondary">
        {label}
      </Badge>
    ),
  )
}
