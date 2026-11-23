import { Wrench } from "lucide-react"

// "N tools", with the wrench icon.
export function ToolCountText({ toolCount }: { toolCount: number }) {
  return (
    <span className="inline-flex items-center gap-1">
      <Wrench className="size-3.5" aria-hidden />
      {toolCount === 1 ? "1 tool" : `${toolCount} tools`}
    </span>
  )
}
