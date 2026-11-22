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

export type CatalogQueryVariables = Exact<{ [key: string]: never }>

export type CatalogQuery = {
  catalog: Array<{
    __typename: "CatalogEntry"
    id: string
    key: string
    displayName: string
    description: string
    iconUrl: string
    authOptions: Array<{ __typename: "CatalogAuthOption"; authType: AuthType }>
    connection: {
      __typename: "Connection"
      id: string
      authType: AuthType
      setupState: SetupState
      enabled: boolean
    } | null
  }>
}

export type SwitchOnCatalogEntryMutationVariables = Exact<{
  catalogEntryId: string | number
  authType: AuthType
}>

export type SwitchOnCatalogEntryMutation = {
  switchOnCatalogEntry: {
    __typename: "Connection"
    id: string
    authType: AuthType
    setupState: SetupState
    enabled: boolean
  }
}

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

export type SetConnectionEnabledMutationVariables = Exact<{
  id: string | number
  enabled: boolean
}>

export type SetConnectionEnabledMutation = {
  setConnectionEnabled: {
    __typename: "Connection"
    id: string
    setupState: SetupState
    enabled: boolean
  }
}

export const CatalogDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "Catalog" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "catalog" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "key" } },
                { kind: "Field", name: { kind: "Name", value: "displayName" } },
                { kind: "Field", name: { kind: "Name", value: "description" } },
                { kind: "Field", name: { kind: "Name", value: "iconUrl" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "authOptions" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "authType" },
                      },
                    ],
                  },
                },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "connection" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "authType" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "setupState" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "enabled" },
                      },
                    ],
                  },
                },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<CatalogQuery, CatalogQueryVariables>
export const SwitchOnCatalogEntryDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SwitchOnCatalogEntry" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "catalogEntryId" },
          },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "authType" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "AuthType" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "switchOnCatalogEntry" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "catalogEntryId" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "catalogEntryId" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "authType" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "authType" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "authType" } },
                { kind: "Field", name: { kind: "Name", value: "setupState" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SwitchOnCatalogEntryMutation,
  SwitchOnCatalogEntryMutationVariables
>
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
export const SetConnectionEnabledDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SetConnectionEnabled" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "enabled" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "Boolean" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "setConnectionEnabled" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
              {
                kind: "Argument",
                name: { kind: "Name", value: "enabled" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "enabled" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "setupState" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SetConnectionEnabledMutation,
  SetConnectionEnabledMutationVariables
>
