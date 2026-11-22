import { useSubscription } from "@apollo/client/react"
import { ConnectionToolsSyncedDocument } from "#/gql/graphql"

// Keeps the tool count of every cached connection live while the calling
// component is mounted. Each event updates the cached connection by id.
// The screen calls it once with no argument. A component that waits for a
// sync passes `onSynced`; Apollo shares one subscription between the calls.
export function useConnectionToolSyncs(
  onSynced?: (connectionId: string) => void,
): void {
  useSubscription(ConnectionToolsSyncedDocument, {
    ignoreResults: true,
    onData: ({ data }) => {
      const id = data.data?.connectionToolsSynced.id
      if (id) onSynced?.(id)
    },
  })
}
