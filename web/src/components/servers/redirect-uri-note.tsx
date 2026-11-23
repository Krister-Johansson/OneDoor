import { Check, Copy } from "lucide-react"
import { useState } from "react"
import { Button } from "#/components/ui/button"
import { useOAuthRedirectUrl } from "#/hooks/use-oauth-redirect-url"

// The redirect URI the owner registers in their OAuth app before they
// authorize (T22), with a copy button.
export function RedirectUriNote() {
  const redirectUrl = useOAuthRedirectUrl()
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(redirectUrl)
      setCopied(true)
    } catch {
      // Without clipboard access the URI is still there to select.
    }
  }

  return (
    <div className="bg-muted/50 flex flex-col gap-1.5 rounded-lg border p-3 text-sm">
      <span className="text-muted-foreground">
        Register this redirect URI in your OAuth app:
      </span>
      <div className="flex items-center gap-2">
        <code className="min-w-0 flex-1 break-all font-mono text-xs">
          {redirectUrl}
        </code>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          onClick={() => void copy()}
          aria-label={copied ? "Copied" : "Copy redirect URI"}
        >
          {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
        </Button>
      </div>
    </div>
  )
}
