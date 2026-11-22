import { Button } from "#/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "#/components/ui/dialog"
import type { AuthType } from "#/gql/graphql"
import { AUTH_TYPE_HINTS, AUTH_TYPE_LABELS } from "#/lib/auth-type"

interface AuthOptionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  authTypes: AuthType[]
  onChoose: (authType: AuthType) => void
}

// Asks which auth option to use when a catalog entry offers more than one
// (REQ-CONN-080).
export function AuthOptionDialog({
  open,
  onOpenChange,
  serverName,
  authTypes,
  onChoose,
}: AuthOptionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect to {serverName}</DialogTitle>
          <DialogDescription>
            {serverName} offers more than one way to connect. Pick one.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-2">
          {authTypes.map((authType) => (
            <Button
              key={authType}
              variant="outline"
              className="h-auto flex-col items-start gap-1 py-3 text-left whitespace-normal"
              onClick={() => onChoose(authType)}
            >
              <span className="font-medium">{AUTH_TYPE_LABELS[authType]}</span>
              <span className="text-muted-foreground text-sm font-normal">
                {AUTH_TYPE_HINTS[authType]}
              </span>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
