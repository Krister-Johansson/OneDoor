import { createFileRoute, useNavigate } from "@tanstack/react-router"
import { CatalogSection } from "#/components/servers/catalog-section"
import { MyServersSection } from "#/components/servers/my-servers-section"
import { OAuthResultMessage } from "#/components/servers/oauth-result-message"
import {
  CatalogDocument,
  ConnectionsDocument,
  OAuthRedirectUrlDocument,
} from "#/gql/graphql"
import { useConnectionStatusChanges } from "#/hooks/use-connection-status-changes"
import { useConnectionToolSyncs } from "#/hooks/use-connection-tool-syncs"
import { oauthSearch } from "#/lib/oauth-outcome"

export const Route = createFileRoute("/servers")({
  // `?oauth=` from the OAuth callback when an authorization could not be
  // tied to a server.
  validateSearch: oauthSearch,
  // Starts both queries before rendering, so the sections do not wait for
  // each other. The hooks read the results from the cache.
  loader: ({ context: { preloadQuery } }) => {
    preloadQuery(CatalogDocument)
    preloadQuery(ConnectionsDocument)
    // The OAuth app fields of the server dialogs show it.
    preloadQuery(OAuthRedirectUrlDocument)
  },
  head: () => ({ meta: [{ title: "Servers · OneDoor" }] }),
  component: ServersPage,
})

function ServersPage() {
  useConnectionStatusChanges()
  useConnectionToolSyncs()
  const { oauth } = Route.useSearch()
  const navigate = useNavigate({ from: Route.fullPath })
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-10 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Servers</h1>
      {oauth && (
        <OAuthResultMessage
          outcome={oauth}
          onDismiss={() => void navigate({ search: {}, replace: true })}
        />
      )}
      <CatalogSection />
      <MyServersSection />
    </div>
  )
}
