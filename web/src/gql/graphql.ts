/** Internal type. DO NOT USE DIRECTLY. */
type Exact<T extends { [key: string]: unknown }> = { [K in keyof T]: T[K] }
/** Internal type. DO NOT USE DIRECTLY. */
export type Incremental<T> =
  | T
  | {
      [P in keyof T]?: P extends " $fragmentName" | "__typename" ? T[P] : never
    }

import type { TypedDocumentNode as DocumentNode } from "@graphql-typed-document-node/core"
/** How OneDoor authenticates to an MCP server (REQ-CONN-040). */
export type AuthType = "API_KEY" | "NONE" | "OAUTH_DCR" | "OAUTH_MANUAL"

/** Whether the credentials of a connection are complete (REQ-CONN-044). */
export type SetupState = "NEEDS_CREDENTIALS" | "READY"

export type ConnectionsQueryVariables = Exact<{ [key: string]: never }>

export type ConnectionsQuery = {
  connections: Array<{
    __typename: "Connection"
    id: string
    catalogEntryId: string | null
    displayName: string
    description: string
    url: string
    authType: AuthType
    headerName: string | null
    headerPrefix: string | null
    hasApiKey: boolean
    oauthClientId: string | null
    hasClientSecret: boolean
    setupState: SetupState
    iconUrl: string
    enabled: boolean
  }>
}

export const ConnectionsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Connections" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "connections" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "catalogEntryId" },
                },
                { kind: "Field", name: { kind: "Name", value: "displayName" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "url" } },
                { kind: "Field", name: { kind: "Name", value: "authType" } },
                { kind: "Field", name: { kind: "Name", value: "headerName" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "headerPrefix" },
                },
                { kind: "Field", name: { kind: "Name", value: "hasApiKey" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "oauthClientId" },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "hasClientSecret" },
                },
                { kind: "Field", name: { kind: "Name", value: "setupState" } },
                { kind: "Field", name: { kind: "Name", value: "iconUrl" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ConnectionsQuery, ConnectionsQueryVariables>
