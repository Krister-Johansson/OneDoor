import { Avatar, AvatarFallback } from "#/components/ui/avatar"
import { useViewer } from "#/hooks/use-viewer"

// The user the app acts for, at the bottom of the sidebar. In the collapsed
// sidebar only the avatar shows.
export function ViewerFooter() {
  const viewer = useViewer()
  return (
    <div className="flex items-center gap-2 rounded-md p-2 group-data-[collapsible=icon]:p-0">
      <Avatar className="size-8">
        <AvatarFallback>{viewer.name.slice(0, 1).toUpperCase()}</AvatarFallback>
      </Avatar>
      <div className="flex min-w-0 flex-col text-sm group-data-[collapsible=icon]:hidden">
        <span className="truncate font-medium">{viewer.name}</span>
        <span className="text-muted-foreground truncate text-xs">
          Local user
        </span>
      </div>
    </div>
  )
}
