import { useNavigate } from "@tanstack/react-router"
import { useState } from "react"
import { Button } from "#/components/ui/button"
import type { AuthType, CatalogQuery, UrlParameterInput } from "#/gql/graphql"
import { useSwitchOnCatalogEntry } from "#/hooks/use-switch-on-catalog-entry"
import { errorCode } from "#/lib/graphql-error"
import { AuthOptionDialog } from "./auth-option-dialog"
import { ConnectionSummary } from "./connection-summary"
import { OAuthAppDialog } from "./oauth-app-dialog"
import { ServerCard } from "./server-card"
import { ToolCountText } from "./tool-count-text"
import { UrlParametersDialog } from "./url-parameters-dialog"

type CatalogEntry = CatalogQuery["catalog"][number]

// One catalog entry (REQ-CONN-080). With a connection it links to the
// server's page, which has the switch and the other actions. Without one it
// offers "Add", which switches the entry on and opens that page.
export function CatalogCard({ entry }: { entry: CatalogEntry }) {
  const connection = entry.connection
  const { switchOn, loading } = useSwitchOnCatalogEntry()
  const navigate = useNavigate()
  const [choosing, setChoosing] = useState(false)
  const [settingUp, setSettingUp] = useState(false)
  // The option whose URL values the dialog asks for (T22).
  const [askingFor, setAskingFor] = useState<AuthType | null>(null)
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

  async function add(authType: AuthType, urlParameters?: UrlParameterInput[]) {
    setChoosing(false)
    setError(null)
    const option = entry.authOptions.find((o) => o.authType === authType)
    if (option && option.urlParameters.length > 0 && !urlParameters) {
      setAskingFor(authType)
      return
    }
    try {
      const { data } = await switchOn(entry.id, authType, urlParameters)
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
  // An entry that offers only that option needs its app before "Add".
  const appOption = entry.authOptions.find((o) => o.authType === "OAUTH_MANUAL")
  const needsApp = authTypes.length === 0 && appOption !== undefined
  const asked = entry.authOptions.find((o) => o.authType === askingFor)

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
      detail={
        needsApp ? (
          <>
            {entry.description}
            <span className="mt-1 block">
              Needs an OAuth app before you can add it.
            </span>
          </>
        ) : (
          entry.description
        )
      }
      aside={
        needsApp ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSettingUp(true)}
            aria-label={`Set up ${entry.displayName}`}
          >
            Set up
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            disabled={loading}
            onClick={onAdd}
            aria-label={`Add ${entry.displayName}`}
          >
            Add
          </Button>
        )
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
      {appOption && (
        <OAuthAppDialog
          catalogEntryId={entry.id}
          serverName={entry.displayName}
          app={appOption}
          open={settingUp}
          onOpenChange={setSettingUp}
        />
      )}
      {asked && (
        <UrlParametersDialog
          open={askingFor !== null}
          onOpenChange={(open) => {
            if (!open) setAskingFor(null)
          }}
          serverName={entry.displayName}
          url={asked.url}
          names={asked.urlParameters}
          onSubmit={async (urlParameters) => {
            setAskingFor(null)
            await add(asked.authType, urlParameters)
          }}
        />
      )}
    </ServerCard>
  )
}

function addErrorMessage(error: unknown, name: string) {
  switch (errorCode(error)) {
    case "CONFLICT":
      return `One of your servers is already named ${name}. Rename it to add this one.`
    case "NOT_FOUND":
      return `${name} is no longer in the catalog.`
    case "VALIDATION":
      return `${name} did not accept these settings. Check the values and try again.`
    default:
      return `Could not add ${name}. Try again.`
  }
}
