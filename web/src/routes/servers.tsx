import { createFileRoute } from "@tanstack/react-router"
import { CatalogSection } from "#/components/servers/catalog-section"
import { MyServersSection } from "#/components/servers/my-servers-section"
import { CatalogDocument, ConnectionsDocument } from "#/gql/graphql"
import { useConnectionStatusChanges } from "#/hooks/use-connection-status-changes"

export const Route = createFileRoute("/servers")({
  // Starts both queries before rendering, so the sections do not wait for
  // each other. The hooks read the results from the cache.
  loader: ({ context: { preloadQuery } }) => {
    preloadQuery(CatalogDocument)
    preloadQuery(ConnectionsDocument)
  },
  head: () => ({ meta: [{ title: "Servers · OneDoor" }] }),
  component: ServersPage,
})

function ServersPage() {
  useConnectionStatusChanges()
  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-10 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Servers</h1>
      <CatalogSection />
      <MyServersSection />
    </main>
  )
}
