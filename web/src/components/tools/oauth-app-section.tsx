import { useState } from "react"
import { OAuthAppDialog } from "#/components/servers/oauth-app-dialog"
import { Button } from "#/components/ui/button"
import { useCatalog } from "#/hooks/use-catalog"
import { useConnectionTools } from "#/hooks/use-connection-tools"
import { useSwitchOnCatalogEntry } from "#/hooks/use-switch-on-catalog-entry"
import { AUTH_TYPE_LABELS } from "#/lib/auth-type"
import { errorCode } from "#/lib/graphql-error"

// The OAuth app of a catalog server that offers OAuth with client details
// (T22). The owner sets the app here, then moves the connection to that
// option. Every connection to the server uses the same app. Renders
// nothing for a custom server or an entry without the option.
export function OAuthAppSection({ connectionId }: { connectionId: string }) {
  const connection = useConnectionTools(connectionId)
  const entry = useCatalog().find((e) => e.id === connection.catalogEntryId)
  const option = entry?.authOptions.find((o) => o.authType === "OAUTH_MANUAL")
  const { switchOn, loading: switching } = useSwitchOnCatalogEntry()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  if (!entry || !option) return null

  const entryId = entry.id
  const name = entry.displayName
  const isSet = option.oauthClientId !== null
  const inUse = connection.authType === "OAUTH_MANUAL"

  async function switchToApp() {
    setError(null)
    try {
      await switchOn(entryId, "OAUTH_MANUAL")
    } catch (caught) {
      setError(
        errorCode(caught) === "VALIDATION"
          ? `Set the OAuth app of ${name} first.`
          : `Could not move ${name} to its OAuth app. Try again.`,
      )
    }
  }

  return (
    <section
      aria-labelledby="oauth-app-heading"
      className="flex flex-col gap-3"
    >
      <div className="flex flex-col gap-1">
        <h2 id="oauth-app-heading" className="text-lg font-semibold">
          OAuth app
        </h2>
        <p className="text-muted-foreground text-sm">
          To sign in to {name} with OAuth, register an OAuth app with {name} and
          enter its details here. Every connection to {name} uses this app.
        </p>
      </div>
      <div className="bg-card divide-y rounded-lg border">
        <div className="flex flex-wrap items-center justify-between gap-3 p-4">
          <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
            <dt className="text-muted-foreground">Client id</dt>
            <dd className="min-w-0 break-all font-mono">
              {option.oauthClientId ?? (
                <span className="font-sans">Not set</span>
              )}
            </dd>
            <dt className="text-muted-foreground">Client secret</dt>
            <dd>{option.hasClientSecret ? "Set" : "Not set"}</dd>
          </dl>
          <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
            {isSet ? "Edit OAuth app" : "Set up OAuth app"}
          </Button>
        </div>
        {isSet && !inUse && (
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex flex-col gap-0.5">
              <span className="font-medium">Sign in with this app</span>
              <span className="text-muted-foreground text-sm">
                {name} uses {AUTH_TYPE_LABELS[connection.authType]} now.
                Switching deletes its stored credentials.
              </span>
            </div>
            <Button
              size="sm"
              disabled={switching}
              onClick={() => void switchToApp()}
            >
              Use {AUTH_TYPE_LABELS.OAUTH_MANUAL}
            </Button>
          </div>
        )}
      </div>
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <OAuthAppDialog
        catalogEntryId={entry.id}
        serverName={name}
        app={option}
        open={editing}
        onOpenChange={setEditing}
      />
    </section>
  )
}
