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

/** Credentials to check before saving (REQ-CONN-062). Nothing is stored. */
export type CheckCredentialsInput = {
  /** Required for API_KEY. */
  apiKey?: string | null | undefined
  /** NONE or API_KEY. */
  authType: AuthType
  /** Defaults to Authorization. */
  headerName?: string | null | undefined
  /** Defaults to Bearer. */
  headerPrefix?: string | null | undefined
  url: string
}

/** The state of a connection's upstream client. OFF: no client is wanted (disabled, not READY, or an auth type without a client yet). FAILED: the last connect failed. REFUSED_CREDENTIALS: the server refused the credentials (401 or 403). FAILED and REFUSED_CREDENTIALS last until the next change to the connection. */
export type ConnectionStatus =
  | "CONNECTED"
  | "CONNECTING"
  | "FAILED"
  | "OFF"
  | "REFUSED_CREDENTIALS"

/** A custom server to add (REQ-CONN-020). */
export type CreateConnectionInput = {
  /** Required for API_KEY, and only for it. Write-only. */
  apiKey?: string | null | undefined
  authType: AuthType
  description?: string | null | undefined
  /** 1 to 60 characters, unique per user ignoring case. */
  displayName: string
  /** Only for API_KEY. Defaults to Authorization. */
  headerName?: string | null | undefined
  /** Only for API_KEY. Defaults to Bearer. May be empty. */
  headerPrefix?: string | null | undefined
  /** Required for OAUTH_MANUAL, and only for it. */
  oauthClientId?: string | null | undefined
  /** Required for OAUTH_MANUAL, and only for it. Write-only. */
  oauthClientSecret?: string | null | undefined
  /** https, or http only for localhost and 127.0.0.1. */
  url: string
}

/** OK: connected and listed the tools. REFUSED_CREDENTIALS: the server answered 401 or 403. The other values mean the same as in ProbeStatus. */
export type CredentialsStatus =
  | "NOT_MCP"
  | "OK"
  | "REFUSED"
  | "REFUSED_CREDENTIALS"
  | "UNREACHABLE"

/** MCP_SERVER: answered MCP initialize. AUTH_REQUIRED: answered 401 or 403. NOT_MCP: answered, but not MCP. UNREACHABLE: no answer within 10 seconds. REFUSED: the network rules stopped the request (REQ-CONN-063). */
export type ProbeStatus =
  | "AUTH_REQUIRED"
  | "MCP_SERVER"
  | "NOT_MCP"
  | "REFUSED"
  | "UNREACHABLE"

/** Whether the credentials of a connection are complete (REQ-CONN-044). */
export type SetupState = "NEEDS_CREDENTIALS" | "READY"

/** Changes to a custom server. A field left out keeps its value. Changing the url or authType deletes the stored credentials unless the same input sets new ones (REQ-CONN-023). */
export type UpdateConnectionInput = {
  /** Left out keeps the stored key, null deletes it, a string replaces it. */
  apiKey?: string | null | undefined
  authType?: AuthType | null | undefined
  /** null clears the description. */
  description?: string | null | undefined
  displayName?: string | null | undefined
  headerName?: string | null | undefined
  headerPrefix?: string | null | undefined
  oauthClientId?: string | null | undefined
  /** Left out keeps the stored secret, null deletes it, a string replaces it. */
  oauthClientSecret?: string | null | undefined
  url?: string | null | undefined
}

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
      oauthAuthorized: boolean
      setupState: SetupState
      enabled: boolean
      status: ConnectionStatus
      toolCount: number
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
    oauthAuthorized: boolean
    setupState: SetupState
    enabled: boolean
    status: ConnectionStatus
    toolCount: number
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
    oauthAuthorized: boolean
    setupState: SetupState
    iconUrl: string
    enabled: boolean
    status: ConnectionStatus
    toolCount: number
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
    status: ConnectionStatus
  }
}

export type CreateConnectionMutationVariables = Exact<{
  input: CreateConnectionInput
}>

export type CreateConnectionMutation = {
  createConnection: { __typename: "Connection"; id: string }
}

export type UpdateConnectionMutationVariables = Exact<{
  id: string | number
  input: UpdateConnectionInput
}>

export type UpdateConnectionMutation = {
  updateConnection: {
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
    oauthAuthorized: boolean
    setupState: SetupState
    iconUrl: string
    enabled: boolean
    status: ConnectionStatus
    toolCount: number
  }
}

export type ResyncToolsMutationVariables = Exact<{
  id: string | number
}>

export type ResyncToolsMutation = {
  resyncTools: { __typename: "Connection"; id: string; toolCount: number }
}

export type StartOAuthAuthorizationMutationVariables = Exact<{
  id: string | number
}>

export type StartOAuthAuthorizationMutation = {
  startOAuthAuthorization: string
}

export type RemoveConnectionMutationVariables = Exact<{
  id: string | number
}>

export type RemoveConnectionMutation = { removeConnection: string }

export type ConnectionStatusChangedSubscriptionVariables = Exact<{
  [key: string]: never
}>

export type ConnectionStatusChangedSubscription = {
  connectionStatusChanged: {
    __typename: "Connection"
    id: string
    status: ConnectionStatus
  }
}

export type ConnectionToolsSyncedSubscriptionVariables = Exact<{
  [key: string]: never
}>

export type ConnectionToolsSyncedSubscription = {
  connectionToolsSynced: {
    __typename: "Connection"
    id: string
    toolCount: number
  }
}

export type ProbeServerMutationVariables = Exact<{
  url: string
}>

export type ProbeServerMutation = {
  probeServer: {
    __typename: "ProbeResult"
    status: ProbeStatus
    message: string
    authRequired: boolean
    oauthDcr: boolean
    suggestedAuthType: AuthType | null
    serverName: string | null
    serverTitle: string | null
  }
}

export type CheckCredentialsMutationVariables = Exact<{
  input: CheckCredentialsInput
}>

export type CheckCredentialsMutation = {
  checkCredentials: {
    __typename: "CredentialsCheck"
    status: CredentialsStatus
    message: string
    toolCount: number | null
    toolNames: Array<string>
  }
}

export type ConnectionToolsQueryVariables = Exact<{
  id: string | number
}>

export type ConnectionToolsQuery = {
  connection: {
    __typename: "Connection"
    id: string
    displayName: string
    url: string
    iconUrl: string
    authType: AuthType
    oauthAuthorized: boolean
    setupState: SetupState
    enabled: boolean
    status: ConnectionStatus
    toolCount: number
    tools: Array<{
      __typename: "Tool"
      id: string
      name: string
      title: string | null
      description: string
      enabled: boolean
      annotations: {
        __typename: "ToolAnnotations"
        readOnlyHint: boolean | null
        destructiveHint: boolean | null
        idempotentHint: boolean | null
        openWorldHint: boolean | null
      }
    }>
  }
}

export type SetToolEnabledMutationVariables = Exact<{
  id: string | number
  enabled: boolean
}>

export type SetToolEnabledMutation = {
  setToolEnabled: { __typename: "Tool"; id: string; enabled: boolean }
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
                        name: { kind: "Name", value: "oauthAuthorized" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "setupState" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "enabled" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "status" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "toolCount" },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "oauthAuthorized" },
                },
                { kind: "Field", name: { kind: "Name", value: "setupState" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "toolCount" } },
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "oauthAuthorized" },
                },
                { kind: "Field", name: { kind: "Name", value: "setupState" } },
                { kind: "Field", name: { kind: "Name", value: "iconUrl" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "toolCount" } },
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
                { kind: "Field", name: { kind: "Name", value: "status" } },
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
export const CreateConnectionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CreateConnection" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CreateConnectionInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "createConnection" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CreateConnectionMutation,
  CreateConnectionMutationVariables
>
export const UpdateConnectionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "UpdateConnection" },
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
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "UpdateConnectionInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "updateConnection" },
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
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
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
                {
                  kind: "Field",
                  name: { kind: "Name", value: "oauthAuthorized" },
                },
                { kind: "Field", name: { kind: "Name", value: "setupState" } },
                { kind: "Field", name: { kind: "Name", value: "iconUrl" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "toolCount" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  UpdateConnectionMutation,
  UpdateConnectionMutationVariables
>
export const ResyncToolsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "ResyncTools" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "resyncTools" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "toolCount" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ResyncToolsMutation, ResyncToolsMutationVariables>
export const StartOAuthAuthorizationDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "StartOAuthAuthorization" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "startOAuthAuthorization" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  StartOAuthAuthorizationMutation,
  StartOAuthAuthorizationMutationVariables
>
export const RemoveConnectionDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "RemoveConnection" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "removeConnection" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  RemoveConnectionMutation,
  RemoveConnectionMutationVariables
>
export const ConnectionStatusChangedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "ConnectionStatusChanged" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "connectionStatusChanged" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ConnectionStatusChangedSubscription,
  ConnectionStatusChangedSubscriptionVariables
>
export const ConnectionToolsSyncedDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "subscription",
      name: { kind: "Name", value: "ConnectionToolsSynced" },
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "connectionToolsSynced" },
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "toolCount" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  ConnectionToolsSyncedSubscription,
  ConnectionToolsSyncedSubscriptionVariables
>
export const ProbeServerDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "ProbeServer" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "url" } },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "String" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "probeServer" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "url" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "url" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "authRequired" },
                },
                { kind: "Field", name: { kind: "Name", value: "oauthDcr" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "suggestedAuthType" },
                },
                { kind: "Field", name: { kind: "Name", value: "serverName" } },
                { kind: "Field", name: { kind: "Name", value: "serverTitle" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<ProbeServerMutation, ProbeServerMutationVariables>
export const CheckCredentialsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "CheckCredentials" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: {
            kind: "Variable",
            name: { kind: "Name", value: "input" },
          },
          type: {
            kind: "NonNullType",
            type: {
              kind: "NamedType",
              name: { kind: "Name", value: "CheckCredentialsInput" },
            },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "checkCredentials" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "input" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "input" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "message" } },
                { kind: "Field", name: { kind: "Name", value: "toolCount" } },
                { kind: "Field", name: { kind: "Name", value: "toolNames" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  CheckCredentialsMutation,
  CheckCredentialsMutationVariables
>
export const ConnectionToolsDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "query",
      name: { kind: "Name", value: "ConnectionTools" },
      variableDefinitions: [
        {
          kind: "VariableDefinition",
          variable: { kind: "Variable", name: { kind: "Name", value: "id" } },
          type: {
            kind: "NonNullType",
            type: { kind: "NamedType", name: { kind: "Name", value: "ID" } },
          },
        },
      ],
      selectionSet: {
        kind: "SelectionSet",
        selections: [
          {
            kind: "Field",
            name: { kind: "Name", value: "connection" },
            arguments: [
              {
                kind: "Argument",
                name: { kind: "Name", value: "id" },
                value: {
                  kind: "Variable",
                  name: { kind: "Name", value: "id" },
                },
              },
            ],
            selectionSet: {
              kind: "SelectionSet",
              selections: [
                { kind: "Field", name: { kind: "Name", value: "id" } },
                { kind: "Field", name: { kind: "Name", value: "displayName" } },
                { kind: "Field", name: { kind: "Name", value: "url" } },
                { kind: "Field", name: { kind: "Name", value: "iconUrl" } },
                { kind: "Field", name: { kind: "Name", value: "authType" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "oauthAuthorized" },
                },
                { kind: "Field", name: { kind: "Name", value: "setupState" } },
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
                { kind: "Field", name: { kind: "Name", value: "status" } },
                { kind: "Field", name: { kind: "Name", value: "toolCount" } },
                {
                  kind: "Field",
                  name: { kind: "Name", value: "tools" },
                  selectionSet: {
                    kind: "SelectionSet",
                    selections: [
                      { kind: "Field", name: { kind: "Name", value: "id" } },
                      { kind: "Field", name: { kind: "Name", value: "name" } },
                      { kind: "Field", name: { kind: "Name", value: "title" } },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "description" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "enabled" },
                      },
                      {
                        kind: "Field",
                        name: { kind: "Name", value: "annotations" },
                        selectionSet: {
                          kind: "SelectionSet",
                          selections: [
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "readOnlyHint" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "destructiveHint" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "idempotentHint" },
                            },
                            {
                              kind: "Field",
                              name: { kind: "Name", value: "openWorldHint" },
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
      },
    },
  ],
} as unknown as DocumentNode<
  ConnectionToolsQuery,
  ConnectionToolsQueryVariables
>
export const SetToolEnabledDocument = {
  kind: "Document",
  definitions: [
    {
      kind: "OperationDefinition",
      operation: "mutation",
      name: { kind: "Name", value: "SetToolEnabled" },
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
            name: { kind: "Name", value: "setToolEnabled" },
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
                { kind: "Field", name: { kind: "Name", value: "enabled" } },
              ],
            },
          },
        ],
      },
    },
  ],
} as unknown as DocumentNode<
  SetToolEnabledMutation,
  SetToolEnabledMutationVariables
>
