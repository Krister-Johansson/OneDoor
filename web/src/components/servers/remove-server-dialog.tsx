import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "#/components/ui/alert-dialog"

interface RemoveServerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  serverName: string
  removing: boolean
  onConfirm: () => void
}

// Asks before a server and its credentials are removed (REQ-CONN-052).
export function RemoveServerDialog({
  open,
  onOpenChange,
  serverName,
  removing,
  onConfirm,
}: RemoveServerDialogProps) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Remove {serverName}?</AlertDialogTitle>
          <AlertDialogDescription>
            OneDoor deletes the server and its stored credentials. Agents can no
            longer use its tools. This cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={removing}
            onClick={onConfirm}
          >
            {removing ? "Removing…" : "Remove"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
