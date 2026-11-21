# Connections

A connection is one user's link to one remote MCP server: its URL, how OneDoor authenticates to it, and the user's settings for it. The gateway searches and executes only the tools of the caller's own connections.

This spec covers the catalog of pre-installed servers, custom servers, credentials, the check before use, and icons. These belong to other specs:

- The OAuth flows (dynamic client registration, authorization, callback, token refresh): `specs/upstreams.md`.
- The upstream client, live status, tool sync and each tool's enabled flag: `specs/upstreams.md`.
- Search and execute: `specs/search.md` and `specs/mcp-endpoint.md`.

## Terms

- User: a person who owns connections. The proof of concept has exactly one user, named `me`. Every request acts as `me`.
- Catalog entry: a pre-installed server that any user can switch on. It fixes the server's name, description, URL, icon and auth type.
- Connection: a user's link to a server. It is either based on a catalog entry or a custom server that the user added.
- Credentials: what a connection needs to authenticate: an API key, OAuth client details, or OAuth tokens.
- Probe: a request that checks an MCP server before the user saves or uses a connection.

## Ownership

### REQ-CONN-001 Every connection has one owner

Every connection belongs to exactly one user. Every read and write of a connection filters by the caller in the database query. A connection owned by another user behaves as if it did not exist.

The proof of concept seeds one user, `me`. The guard attaches `me` as the caller of every GraphQL and MCP request. Sign-in comes later and replaces only the guard.

- WHEN `me` lists connections THEN the result holds only connections owned by `me`.
- WHEN a caller reads, updates or removes a connection owned by another user THEN the API answers `NOT_FOUND`.

### REQ-CONN-002 Connections are not shared

Users do not share connections or credentials. When two users switch on the same catalog entry, each gets a separate connection with separate credentials. The tools found through search are those of the caller's connections, so a search for a GitHub tool uses the caller's own GitHub account.

- WHEN two users switch on the same catalog entry THEN two connections exist, each with its owner's credentials.

## Catalog

### REQ-CONN-010 Catalog entries

A catalog entry has:

- a display name and a description,
- a URL,
- an icon,
- an auth type (see REQ-CONN-040),
- for `API_KEY`: the header name and header prefix,
- for `OAUTH_MANUAL`: the OAuth client id and client secret.

The catalog is seeded with entries for GitHub, Context7 and Azure DevOps. The API cannot create, change or delete catalog entries. A migration or seed changes them.

The client id and client secret of an `OAUTH_MANUAL` entry come from server config, never from a committed seed file. The client secret is a secret (REQ-CONN-041).

- WHEN the server starts on an empty database and the seed runs THEN the catalog holds the GitHub, Context7 and Azure DevOps entries.
- WHEN a client tries to change a catalog entry through the API THEN no operation for it exists.

### REQ-CONN-011 Listing the catalog

The catalog query returns every entry with the caller's connection for it, if one exists, so the web can show each entry as switched on or off and whether it needs credentials.

- WHEN `me` has switched on GitHub and nothing else THEN the catalog lists GitHub with `me`'s connection, and Context7 and Azure DevOps with none.

### REQ-CONN-012 Switching on a catalog entry

Switching on an entry creates a connection for the caller that references the entry. The connection takes its display name, description, URL, icon, auth type and header settings from the entry. The user cannot change them on the connection. A later change to the entry applies to every connection based on it.

A caller has at most one connection per catalog entry. Switching on an entry the caller already has a connection for enables that connection.

- WHEN `me` switches on Context7 for the first time THEN a connection exists that references the Context7 entry and is enabled.
- WHEN `me` switches on Context7 again after switching it off THEN the existing connection is enabled and no second connection is created.
- WHEN `me` already has a custom connection with the entry's display name THEN switching on the entry answers `CONFLICT`, and the message says to rename the custom connection.

## Custom servers

### REQ-CONN-020 Adding a custom server

A user adds a custom server with:

- a display name,
- an optional description,
- a URL,
- an auth type,
- for `API_KEY`: the API key, the header name (default `Authorization`) and the header prefix (default `Bearer`, may be empty),
- for `OAUTH_MANUAL`: the OAuth client id and client secret.

A new custom connection is enabled.

- WHEN `me` adds "Acme MCP" at `https://mcp.example.com/mcp` with auth type `NONE` THEN a connection exists with that name and URL, enabled and `READY`.

### REQ-CONN-021 Display name

The display name is 1 to 60 characters after trimming spaces at both ends. It is unique among one owner's connections, catalog-based and custom, ignoring case. Agents see it as the server name, and search indexes it.

The owner can rename a custom connection at any time. A catalog-based connection uses the entry's name.

- WHEN `me` adds a custom server named "github" while having switched on the GitHub catalog entry THEN the API answers `CONFLICT`.
- WHEN `me` adds a custom server with a name of only spaces THEN the API answers `VALIDATION`.

### REQ-CONN-022 URL

The URL:

- uses `https`, or `http` only for the hosts `localhost` and `127.0.0.1`,
- has no user name or password,
- is at most 2048 characters.

Two connections may have the same URL, for example two accounts on one server.

- WHEN `me` adds a server at `http://mcp.example.com/mcp` THEN the API answers `VALIDATION`.
- WHEN `me` adds a server at `http://localhost:4000/mcp` THEN the connection is created.
- WHEN `me` adds a server at `https://user:pass@mcp.example.com/mcp` THEN the API answers `VALIDATION`.

### REQ-CONN-023 Changing a custom server

The owner can change every field of a custom connection. Changing the URL or the auth type deletes the stored credentials and OAuth tokens, unless the same update sets new credentials. Credentials are never sent to a URL they were not entered for.

- WHEN `me` changes the URL of a connection with an API key and sends no new key THEN the stored key is deleted and the connection needs credentials.
- WHEN `me` changes the URL and sends a new API key in the same update THEN the new key is stored.

## Credentials

### REQ-CONN-040 Auth types

| Auth type | Shown as | Credentials |
|---|---|---|
| `NONE` | No authentication | none |
| `API_KEY` | API key | an API key, sent in one header |
| `OAUTH_DCR` | DCR OAuth | OAuth tokens, from a client registered dynamically with the server |
| `OAUTH_MANUAL` | OAuth with client details | OAuth tokens, from a client id and secret entered in advance |

For `API_KEY`, the request header is the header name, and its value is the prefix, a space and the key. With an empty prefix the value is the key alone.

- WHEN the header name is `Authorization`, the prefix is `Bearer` and the key is `abc` THEN requests to the server carry `Authorization: Bearer abc`.
- WHEN the header name is `X-Api-Key`, the prefix is empty and the key is `abc` THEN requests carry `X-Api-Key: abc`.

### REQ-CONN-041 Secrets

The API key, the OAuth client secret and OAuth tokens are secrets. The server encrypts each secret with `SecretStore` before it is stored, and stores the key id with it. No GraphQL field, log line or error message contains a secret. GraphQL exposes only `hasApiKey` and `hasClientSecret` as booleans, and whether OAuth is authorized.

- WHEN `me` saves an API key THEN the database holds only its ciphertext and key id.
- WHEN `me` reads the connection THEN the response has `hasApiKey: true` and no key.

### REQ-CONN-042 Updating a secret

In an update, a secret field that is left out keeps its stored value, `null` deletes it, and a string replaces it.

- WHEN `me` updates the description and leaves out `apiKey` THEN the stored key is unchanged.
- WHEN `me` sends `apiKey: null` THEN the key is deleted and the connection needs credentials.

### REQ-CONN-043 Header and key rules

- The header name is an HTTP token of 1 to 100 characters. These names are refused: `Host`, `Content-Length`, `Content-Type`, `Transfer-Encoding`, `Connection`, `Mcp-Session-Id`, `Mcp-Protocol-Version`.
- The prefix is 0 to 50 characters.
- The API key is 1 to 4096 characters.
- None of them may contain a control character, such as CR or LF.

- WHEN `me` sends an API key that contains a line break THEN the API answers `VALIDATION`.
- WHEN `me` sets the header name to `Host` THEN the API answers `VALIDATION`.

### REQ-CONN-044 Setup state

A connection is `NEEDS_CREDENTIALS` until its auth type's credentials are complete, and `READY` after that:

- `NONE`: always `READY`.
- `API_KEY`: `READY` when an API key is stored.
- `OAUTH_DCR`: `READY` when OAuth tokens are stored.
- `OAUTH_MANUAL`: `READY` when the client details exist (on the connection or its catalog entry) and OAuth tokens are stored.

- WHEN `me` switches on an `API_KEY` catalog entry THEN the connection is `NEEDS_CREDENTIALS`.
- WHEN `me` then saves an API key THEN the connection is `READY`.

## Enabled and removal

A connection has no mode such as read-only. OneDoor cannot know what a tool does: MCP tool annotations are optional, and they are hints that a server may get wrong. The owner enables or disables each tool instead, as `specs/upstreams.md` describes.

### REQ-CONN-051 Enabled

A connection is enabled or disabled. A new connection is enabled. The gateway uses a connection only when it is enabled and `READY`. Disabling a connection:

- hides its tools from search,
- makes execute refuse its tools,
- closes its upstream client.

It keeps the credentials, the tools and the settings. Switching a catalog entry off disables its connection.

- WHEN `me` disables the GitHub connection THEN search returns no GitHub tools and the stored API key is unchanged.
- WHEN `me` enables it again THEN its tools are found again without entering credentials.

### REQ-CONN-052 Removing a connection

Removing a connection deletes it together with its credentials, OAuth tokens, tools, embeddings and tool policy. The web asks for confirmation first and shows the connection's name. A removed catalog-based connection shows its entry as switched off.

- WHEN `me` removes the Context7 connection THEN the connection and its tools no longer exist, and the catalog lists Context7 with no connection.
- WHEN `me` removes a connection id that does not exist THEN the API answers `NOT_FOUND`.

## Check before use

### REQ-CONN-060 Probe without credentials

The add dialog probes a URL before the connection is saved. The probe sends an MCP initialize request without credentials and reports:

- whether the server answered,
- whether it speaks MCP,
- whether it requires authentication, read from a 401 response and the OAuth metadata it points to,
- whether it supports OAuth with dynamic client registration,
- the server's name, title, version, description and icons, when it returns them without credentials.

The probe stores nothing. It gives up after 10 seconds.

- WHEN `me` probes a server that answers initialize without credentials THEN the result has its name and title, and `authRequired: false`.
- WHEN `me` probes a server that answers 401 and offers dynamic client registration THEN the result has `authRequired: true` and `oauthDcr: true`.
- WHEN `me` probes a URL that does not answer within 10 seconds THEN the result says the server did not answer.

### REQ-CONN-061 Pre-filling the dialog

The add dialog fills in fields from the probe result. The user can change all of them.

- The display name is the server's title, or its name when it has no title.
- The auth type is `OAUTH_DCR` when the server offers dynamic client registration, `API_KEY` when it requires authentication without it, and `NONE` when it requires none.

- WHEN the probe of a server returns the title "Acme Tools" and `authRequired: false` THEN the dialog shows "Acme Tools" as the display name and "No authentication" as the auth type.

### REQ-CONN-062 Checking credentials

For `NONE` and `API_KEY`, the user can check the credentials before saving. The check connects with the entered credentials, lists the tools, and reports the tool count and the first five tool names. It stores nothing, including the credentials. For the OAuth types, the same check runs after authorization, as described in `specs/upstreams.md`.

- WHEN `me` checks a valid API key THEN the result has the tool count and up to five tool names.
- WHEN `me` checks an API key that the server refuses THEN the result says the server refused the credentials, and the result does not contain the key.

### REQ-CONN-063 Network rules for fetching

The probe, the credentials check and the icon fetch follow these rules:

- The URL passes REQ-CONN-022.
- The host name is resolved first. A request to a private, link-local, loopback or cloud metadata address is refused, except `localhost` and `127.0.0.1` when the URL names them.
- At most 3 redirects are followed, and each target passes the same rules.
- A response body larger than 1 MB is cut off and the request fails.

- WHEN `me` probes `https://169.254.169.254/` THEN the probe is refused without a request being sent.
- WHEN a server redirects the probe to `http://10.0.0.5/` THEN the probe stops at the redirect.

## Icons

### REQ-CONN-070 Icon source

A connection's icon is the first of these that works:

1. the server's own MCP `icons`,
2. the favicon of the URL's origin,
3. a generated icon with the first letter of the display name.

A catalog-based connection uses its entry's icon. The server fetches the icon when a custom connection is created and when its URL changes.

- WHEN a server returns no `icons` and its origin has a favicon THEN the connection's icon is that favicon.
- WHEN neither works THEN the connection's icon is the generated letter icon.

### REQ-CONN-071 Storing and serving icons

The server fetches icons under REQ-CONN-063, stores the bytes, and serves them from OneDoor's own origin. The web never loads an icon from the upstream's host.

- An icon is at most 256 KB.
- An icon is PNG, JPEG, WebP, GIF, ICO or SVG, checked from the bytes, not from the declared content type.
- SVG is served with `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'` and `X-Content-Type-Options: nosniff`.

- WHEN an icon URL returns HTML with an `image/png` content type THEN the icon is refused and the next source is tried.
- WHEN an icon is 300 KB THEN it is refused and the next source is tried.

## API

GraphQL serves the web. Names are final in code; the operations are:

| Operation | Kind | Requirements |
|---|---|---|
| `catalog` | query | REQ-CONN-011 |
| `connections`, `connection(id)` | query | REQ-CONN-001 |
| `switchOnCatalogEntry(catalogEntryId)` | mutation | REQ-CONN-012 |
| `createConnection(input)` | mutation | REQ-CONN-020 to REQ-CONN-023 |
| `updateConnection(id, input)` | mutation | REQ-CONN-023, REQ-CONN-042 |
| `setConnectionEnabled(id, enabled)` | mutation | REQ-CONN-051 |
| `removeConnection(id)` | mutation | REQ-CONN-052 |
| `probeServer(url)` | mutation | REQ-CONN-060 |
| `checkCredentials(input)` | mutation | REQ-CONN-062 |

`probeServer` and `checkCredentials` are mutations because they send requests to other hosts.

Errors use the domain error codes: a duplicate display name is `CONFLICT`; an invalid field or a missing required credential is `VALIDATION`; an unknown or foreign connection id is `NOT_FOUND`.

## Web

### REQ-CONN-080 Servers screen

The servers screen has two sections:

- Catalog: one card per entry with its icon, name and description, a switch, and "Needs credentials" when the caller's connection is `NEEDS_CREDENTIALS`.
- My servers: the caller's custom connections, sorted by display name, each with its icon, name, URL, auth type and enabled state, and links to edit and remove.

- WHEN `me` has no custom connections THEN "My servers" shows an empty state with the "Add server" action.

### REQ-CONN-081 Add server dialog

The dialog has the display name, the MCP server URL and the authentication type (DCR OAuth, OAuth with client details, API key, No authentication). For API key it shows the key field and a collapsed "Advanced settings" section with the header name and header prefix. For OAuth with client details it shows the client id and client secret. Leaving the URL field runs the probe (REQ-CONN-060) and fills in the fields (REQ-CONN-061).

- WHEN `me` picks "API key" THEN the dialog shows the key field, and "Advanced settings" holds `Authorization` and `Bearer`.

### REQ-CONN-082 Secret fields

In the edit form, each secret field shows "Set" or "Not set", never the value. The user can replace or clear it.

- WHEN `me` opens the edit form of a connection with an API key THEN the key field shows "Set" and an empty input.

## Open questions

- The seed values for GitHub, Context7 and Azure DevOps (URL, auth type, header settings) are not decided. Check each against the vendor's current documentation before seeding. The Azure DevOps server may use a URL per organization, which a fixed catalog URL cannot express.
- Tools are stored per connection, because a server can list different tools for different credentials. `specs/upstreams.md` and `specs/search.md` decide this, and whether embeddings are reused across connections when the embedded text matches.
- Sharing connections within a team is out of scope and may come later.
