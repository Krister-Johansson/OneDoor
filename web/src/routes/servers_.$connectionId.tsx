import {
  createFileRoute,
  type ErrorComponentProps,
  Link,
} from "@tanstack/react-router"
import { ServerHeader } from "#/components/tools/server-header"
import { ToolsSection } from "#/components/tools/tools-section"
import { buttonVariants } from "#/components/ui/button"
import { ConnectionToolsDocument } from "#/gql/graphql"
import { useConnectionStatusChanges } from "#/hooks/use-connection-status-changes"
import { errorCode } from "#/lib/graphql-error"

// The tools screen of one connection (T19). `servers_` keeps it out of the
// servers screen's component, so it renders on its own.
export const Route = createFileRoute("/servers_/$connectionId")({
  loader: ({ context: { preloadQuery }, params: { connectionId } }) => {
    preloadQuery(ConnectionToolsDocument, { variables: { id: connectionId } })
  },
  head: () => ({ meta: [{ title: "Server · OneDoor" }] }),
  component: ServerPage,
  errorComponent: ServerError,
})

function ServerPage() {
  const { connectionId } = Route.useParams()
  useConnectionStatusChanges()
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-8 p-4 sm:p-8">
      <ServerHeader connectionId={connectionId} />
      <ToolsSection connectionId={connectionId} />
    </div>
  )
}

function ServerError({ error }: ErrorComponentProps) {
  const message =
    errorCode(error) === "NOT_FOUND"
      ? "This server does not exist, or it was removed."
      : "Could not load this server. Try again."
  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col items-start gap-4 p-4 sm:p-8">
      <h1 className="text-2xl font-bold">Server</h1>
      <p role="alert">{message}</p>
      <Link to="/servers" className={buttonVariants({ variant: "outline" })}>
        Back to servers
      </Link>
    </div>
  )
}
