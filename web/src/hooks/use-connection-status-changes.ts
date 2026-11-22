import { useSubscription } from "@apollo/client/react"
import { ConnectionStatusChangedDocument } from "#/gql/graphql"

// Keeps the status of every cached connection live while the calling
// component is mounted. Each event updates the cached connection by id, so
// every view of it re-renders and the hook returns nothing. Call it once
// per screen.
export function useConnectionStatusChanges(): void {
  useSubscription(ConnectionStatusChangedDocument)
}
