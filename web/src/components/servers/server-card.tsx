import { Link } from "@tanstack/react-router"
import { cn } from "cn"
import { BadgeCheck } from "lucide-react"
import type { ReactNode } from "react"

interface ServerCardProps {
  name: string
  iconUrl: string
  // Catalog entries carry a check mark after the name.
  fromCatalog: boolean
  // Shown under the name, such as the tool count.
  detail?: ReactNode
  // At the right: the state, or an action for a server with no connection.
  aside?: ReactNode
  // The server's page. Without it the card is not a link.
  connectionId?: string
  children?: ReactNode
}

// One server in the grid of the servers screen. A card for a connection is
// a link to its page, where every action is; a catalog entry with no
// connection holds its own action instead.
export function ServerCard({
  name,
  iconUrl,
  fromCatalog,
  detail,
  aside,
  connectionId,
  children,
}: ServerCardProps) {
  const body = (
    <>
      <img src={iconUrl} alt="" className="size-10 shrink-0 rounded-md" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="flex items-center gap-1.5 font-medium">
          <span className="truncate">{name}</span>
          {fromCatalog && (
            <BadgeCheck
              className="text-muted-foreground size-4 shrink-0"
              aria-label="From the catalog"
            />
          )}
        </span>
        {detail && (
          <span className="text-muted-foreground text-sm">{detail}</span>
        )}
      </div>
      {aside}
    </>
  )
  const frame = "bg-card flex min-h-20 items-center gap-3 rounded-lg border p-4"
  return (
    <li className="flex flex-col gap-2">
      {connectionId ? (
        <Link
          to="/servers/$connectionId"
          params={{ connectionId }}
          className={cn(
            frame,
            "hover:bg-muted/50 focus-visible:ring-ring/50 outline-none transition-colors focus-visible:ring-3",
          )}
        >
          {body}
        </Link>
      ) : (
        <div className={frame}>{body}</div>
      )}
      {children}
    </li>
  )
}
