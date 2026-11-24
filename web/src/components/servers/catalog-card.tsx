import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "#/components/ui/button"
import type { AuthType, CatalogQuery } from "#/gql/graphql"
import { useSwitchOnCatalogEntry } from "#/hooks/use-switch-on-catalog-entry"
import { errorCode } from "#/lib/graphql-error"
import { AuthOptionDialog } from "./auth-option-dialog"
import { ConnectionSummary } from "./connection-summary"
import { ServerCard } from "./server-card"
import { ToolCountText } from "./tool-count-text"

type CatalogEntry = CatalogQuery["catalog"][number]

// One catalog entry (REQ-CONN-080). With a connection it links to the
// server's page, which has the switch and the other actions. Without one it
// offers "Add", which switches the entry on and opens that page.
export function CatalogCard({ entry }: { entry: CatalogEntry }) {
  const connection = entry.connection
  const { switchOn, loading } = useSwitchOnCatalogEntry()
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (connection) {
    return (
      <ServerCard
        name={entry.displayName}
        iconUrl={entry.iconUrl}
        fromCatalog
        connectionId={connection.id}
        detail={<ToolCountText toolCount={connection.toolCount} />}
        aside={<ConnectionSummary connection={connection} />}
      />
    )
  }

  async function add(authType: AuthType) {
    setChoosing(false)
    setError(null)
    try {
      const { data } = await switchOn(entry.id, authType)
      const id = data?.switchOnCatalogEntry.id
      if (id) {
        await navigate({
          to: "/servers/$connectionId",
          params: { connectionId: id },
        })
      }
    } catch (caught) {
      setError(addErrorMessage(caught, entry.displayName))
    }
  }

  // OAuth with client details is offered once its OAuth app is set (T22).
  const authTypes = entry.authOptions
    .filter((o) => o.authType !== "OAUTH_MANUAL" || o.oauthClientId !== null)
    .map((o) => o.authType)

  function onAdd() {
    const [only] = authTypes
    if (authTypes.length === 1 && only) void add(only)
    else setChoosing(true)
  }

  return (
    <ServerCard
      name={entry.displayName}
      iconUrl={entry.iconUrl}
      fromCatalog
      detail={entry.description}
      aside={
        <Button
          variant="outline"
          size="sm"
          disabled={loading}
          onClick={onAdd}
          aria-label={`Add ${entry.displayName}`}
        >
          Add
        </Button>
      }
    >
      {error && (
        <p role="alert" className="text-destructive text-sm">
          {error}
        </p>
      )}
      <AuthOptionDialog
        open={choosing}
        onOpenChange={setChoosing}
        serverName={entry.displayName}
        authTypes={authTypes}
        onChoose={(authType) => void add(authType)}
      />
    </ServerCard>
  )
}

function addErrorMessage(error: unknown, name: string) {
  switch (errorCode(error)) {
    case "CONFLICT":
      return `One of your servers is already named ${name}. Rename it to add this one.`
    case "NOT_FOUND":
      return `${name} is no longer in the catalog.`
    default:
      return `Could not add ${name}. Try again.`
  }
}
