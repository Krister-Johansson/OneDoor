import { useState } from "react"
import { Badge } from "#/components/ui/badge"
import {
  Card,
  CardAction,
  CardDescription,
  CardHeader,
  CardTitle,
} from "#/components/ui/card"
import { Switch } from "#/components/ui/switch"
import type { AuthType, CatalogQuery } from "#/gql/graphql"
import { useSetConnectionEnabled } from "#/hooks/use-set-connection-enabled"
import { useSwitchOnCatalogEntry } from "#/hooks/use-switch-on-catalog-entry"
import { errorCode } from "#/lib/graphql-error"
import { AuthOptionDialog } from "./auth-option-dialog"
import { ConnectionStatusBadge } from "./connection-status-badge"
import { ResyncToolsButton } from "./resync-tools-button"
import { ToolCountBadge } from "./tool-count-badge"

type CatalogEntry = CatalogQuery["catalog"][number]

// One catalog entry with its switch (REQ-CONN-080).
export function CatalogCard({ entry }: { entry: CatalogEntry }) {
  const { switchOn, loading: switchingOn } = useSwitchOnCatalogEntry()
  const { setEnabled, loading: switchingOff } = useSetConnectionEnabled()
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const connection = entry.connection

  async function run(on: boolean, action: () => Promise<unknown>) {
    setError(null)
    try {
      await action()
    } catch (caught) {
      setError(switchErrorMessage(caught, entry.displayName, on))
    }
  }

  function turnOn(authType: AuthType) {
    setChoosing(false)
    void run(true, () => switchOn(entry.id, authType))
  }

  function onCheckedChange(checked: boolean) {
    if (!checked) {
      if (connection) void run(false, () => setEnabled(connection.id, false))
      return
    }
    // An existing connection keeps its auth option and its credentials.
    const authType =
      connection?.authType ??
      (entry.authOptions.length === 1
        ? entry.authOptions[0]?.authType
        : undefined)
    if (authType) turnOn(authType)
    else setChoosing(true)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <img
            src={entry.iconUrl}
            alt=""
            className="size-8 shrink-0 rounded-sm"
          />
          <CardTitle>{entry.displayName}</CardTitle>
        </div>
        <CardDescription>{entry.description}</CardDescription>
        <CardAction>
          <Switch
            checked={connection?.enabled ?? false}
            disabled={switchingOn || switchingOff}
            onCheckedChange={onCheckedChange}
            aria-label={`Use ${entry.displayName}`}
          />
        </CardAction>
        {connection?.setupState === "NEEDS_CREDENTIALS" && (
          <Badge variant="outline">Needs credentials</Badge>
        )}
        {connection && (
          <div className="flex flex-wrap items-center gap-2">
            <ConnectionStatusBadge status={connection.status} />
            <ToolCountBadge connection={connection} />
            <ResyncToolsButton
              connection={connection}
              serverName={entry.displayName}
              onError={setError}
            />
          </div>
        )}
        {error && (
          <p role="alert" className="text-destructive text-sm">
            {error}
          </p>
        )}
      </CardHeader>
      <AuthOptionDialog
        open={choosing}
        onOpenChange={setChoosing}
        serverName={entry.displayName}
        authTypes={entry.authOptions.map((option) => option.authType)}
        onChoose={turnOn}
      />
    </Card>
  )
}

function switchErrorMessage(error: unknown, name: string, on: boolean) {
  switch (errorCode(error)) {
    case "CONFLICT":
      return `One of your servers is already named ${name}. Rename it to switch this entry on.`
    case "NOT_FOUND":
      return `${name} is no longer in the catalog.`
    default:
      return `Could not switch ${name} ${on ? "on" : "off"}. Try again.`
  }
}
