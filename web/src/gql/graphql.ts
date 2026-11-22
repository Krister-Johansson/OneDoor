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
    setupState: SetupState
    iconUrl: string
    enabled: boolean
  }
}

export type RemoveConnectionMutationVariables = Exact<{
  id: string | number
}>

export type RemoveConnectionMutation = { removeConnection: string }

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
} as unknown as DocumentNode<
  UpdateConnectionMutation,
  UpdateConnectionMutationVariables
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
