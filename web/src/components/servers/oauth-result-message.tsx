import { X } from "lucide-react"
import { Button } from "#/components/ui/button"
import type { OAuthOutcome } from "#/lib/oauth-outcome"

const MESSAGES: Record<OAuthOutcome, string> = {
  authorized: "Authorized. OneDoor is connecting to the server.",
  denied: "The authorization was cancelled or refused.",
  failed: "The authorization did not complete. Try again.",
  expired:
    "That authorization link expired or was already used. Start the authorization again.",
}

// The outcome of an OAuth authorization, shown once on the page the
// callback sent the browser to (T21).
export function OAuthResultMessage({
  outcome,
  onDismiss,
}: {
  outcome: OAuthOutcome
  onDismiss: () => void
}) {
  const success = outcome === "authorized"
  return (
    <div
      role={success ? "status" : "alert"}
      className={
        success
          ? "flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
          : "border-destructive/40 text-destructive flex items-start justify-between gap-3 rounded-lg border p-3 text-sm"
      }
    >
      <p>{MESSAGES[outcome]}</p>
      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onDismiss}
        aria-label="Dismiss"
      >
        <X aria-hidden />
      </Button>
    </div>
  )
}
