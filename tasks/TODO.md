# Tasks

Work one task at a time, in order, each on its own branch. A task is done when `pnpm verify` passes in every project it touched.

- "Checkpoint" means the task introduces a new pattern. Stop after it for review, then record the approved pattern in `docs/conventions.md`.
- "Needs spec" means the task waits until the human has written that spec in `specs/`. The spec file names below are proposals.
- "Human review" means the task touches code listed under "Code the human always reviews" in `AGENTS.md`.

## Done

- [x] T00 Scaffold `server/` and `web/` with Biome, the cross-project import rule and `verify` scripts.
- [x] T01 Server config. `@nestjs/config` with a Zod schema and the `app` namespace (`HOST`, `PORT`), and `server/.env.example`. The server listens on `HOST`, default `127.0.0.1`.
- [x] T02 Docker Compose for development data services: Postgres 19 with `pgvector`, and Redis 8.8. The api, web and proxy services come in T31.
- [x] T03 Prisma client. Prisma 7.10.1 pinned exactly, the `prisma-client` generator writing to the git-ignored `src/generated/prisma`, the `database` config namespace, `PrismaModule` with one client on `PrismaPg`, and a Testcontainers database test.
- [x] T04 Health checks. `HealthModule` with Terminus, `GET /health/live` and `GET /health/ready` (Postgres and Redis), the `redis` config namespace, and a Testcontainers e2e test.
- [x] T05 Domain errors. Six domain errors with stable codes, `toDomainError()` for Prisma errors, and `DomainErrorFilter` registered with `APP_FILTER` (HTTP; GraphQL added in T07).
- [x] T06 User, catalog and connection models. `User`, `CatalogEntry` and `Connection` with citext display names and three check constraints, migration `20261121233730_connections`, and the seed for `me`.
- [x] T07 GraphQL setup and the `connections` query. Apollo code-first, `server/schema.gql` with a drift test, `CallerGuard` attaching `me`, `connections` and `connection(id)` filtered by owner, and GraphQL error codes from `DomainErrorFilter`.
- [x] T08 Secret storage. `SecretStore` with `AesGcmSecretStore` (AES-256-GCM, context as associated data), the `crypto` config namespace, and the factory binding in `CryptoModule`.
- [x] T09 Custom connections. `createConnection`, `updateConnection`, `setConnectionEnabled` and `removeConnection`, class-validator inputs with a global `ValidationPipe`, and API keys and client secrets encrypted with `SecretStore` (migration `20261122000306_connection_secrets`).
- [x] T10 Catalog. Catalog entries with auth options, GitHub (API key) and Context7 (OAuth with DCR, or API key) in the seed, the `catalog` query, `switchOnCatalogEntry`, and API keys for catalog-based connections (migration `20261122002230_catalog_auth_options`).
- [x] T11 Probe and credentials check. `GuardedFetch` in `NetModule` with the network rules, `probeServer` (MCP initialize and OAuth discovery) and `checkCredentials`, and the first test twins.
- [x] T12 Server icons. MCP icons, then the favicon, then a letter icon, fetched in the background through `GuardedFetch`, checked from the bytes, and served from `/icons` (migration `20261122004055_icons`).
- [x] T13 Web GraphQL client. Apollo Client 4 through `@apollo/client-integration-tanstack-start`, GraphQL Code Generator reading `../server/schema.gql` into `src/gql/graphql.ts`, the `codegen` script and its drift check in web `verify`, and the Nitro proxy for `/graphql` and `/icons`.
- [x] T14 Servers screen. `/servers` with the catalog cards and "My servers" (REQ-CONN-080), `useCatalog()` and `useConnections()` read from queries the route loader preloads, and the first shadcn components. The catalog switch and the add, edit and remove actions are disabled until mutations exist.
- [x] T15 Catalog switch and server dialogs. The catalog switch with the auth option choice, the add dialog with probe pre-fill and the credentials check (TanStack Form), the edit form with write-only secrets, and remove with confirmation (REQ-CONN-080 to 082).
- [x] T15b Web end-to-end tests. Playwright with `pnpm e2e` (not part of `verify`), global setup with containers, a web twin, the built server and web app, and flows for adding a server and the catalog switch.
- [x] T16 Upstream registry. `UpstreamRegistryService` with one MCP client per enabled, `READY` and `NONE` connection, connected from `onApplicationBootstrap` without blocking, synced after every connection write, closed in `onModuleDestroy`, and the `upstreams` config namespace (`UPSTREAM_CONNECTING`).
- [x] T17 Live connection status. `EventBus` with `RedisEventBus` (`EVENT_BUS`), `Connection.status` (OFF, CONNECTING, CONNECTED, FAILED) from the registry, the `connectionStatusChanged` subscription over `graphql-ws` with a socket origin check, and a live status badge on the servers screen.

## Connections

Spec: `specs/connections.md`.

## Upstream servers

Needs spec: `specs/upstreams.md`. Needs fake upstream MCP servers in `server/test/twins/`, which are human-owned.

- [x] T18 Tool sync. A BullMQ job when a connection becomes enabled and `READY`, and on tool-list change: list tools, diff by content hash, store the tools. Adds a "re-sync tools" action. Server in PR #51, web and the `connectionToolsSynced` subscription in PR #55.
- [x] T19 Tool policy. An enabled flag per tool, set by the owner, with new tools enabled. MCP annotations are shown as labels and never enforced. Adds the tools screen per connection. Server in PR #57, the web tools screen in PR #60.
- [x] T20 Upstream auth with an API key. `UpstreamAuthProvider` abstract class with the `NONE` and `API_KEY` implementations, and the `REFUSED_CREDENTIALS` status. Human review: credential handling. PR #62.
- [ ] T21 Upstream auth with OAuth and dynamic client registration (`OAUTH_DCR`). Human review: OAuth flow, callback, token refresh, discovery URL fetching. The server part is merged (PR #64); the web Authorize action and the Nitro forward of `/oauth` are open.
- [ ] T22 Upstream auth with OAuth and client details (`OAUTH_MANUAL`). Adds OAuth client details for catalog auth options from server config, an `OAUTH_MANUAL` option for GitHub (a GitHub OAuth app), and Azure DevOps (organization per connection, a public Entra client; see the spec's open questions). Human review: OAuth flow.

## Search

Needs spec: `specs/search.md`. The golden set lives in `scenarios/`.

- [ ] T23 Keyword search. `ToolDocumentBuilder` template v1, tool-name splitting, the `Retriever` abstract class with `PgFtsRetriever`, and `SearchFilter` (the caller and optional connection ids) as a required argument.
- [ ] T24 Vector search. `Embedder` with OpenRouter and a multilingual model, the `tool_embedding` table, re-embedding only on hash change, `PgVectorRetriever` with an exact scan, the Redis query-embedding cache, and the keyword-only fallback. Human review: migration.
- [ ] T25 Ranking. `Fuser` with reciprocal rank fusion (`k = 60`), a pass-through `Reranker`, exact tool-name matches first, and one log line per search. Run the golden set.
- [ ] T26 Example queries. `LlmClient` with OpenRouter, `ExampleQueryGenerator`, and roles mapped to models in config.

## MCP endpoint

Needs spec: `specs/mcp-endpoint.md`.

- [ ] T27 The `search` tool. `/mcp` with `@nestjs/mcp` pinned exactly, the guard that attaches `me` as the caller, and tests through `connectMcpClient`. Human review: the endpoint guard.
- [ ] T28 The `execute` tool. Look up the tool by id, check the policy and that the caller owns the connection, validate the arguments, forward to the upstream, and return failures as results with `isError: true`. Human review: permission check.

## Test chat

Needs spec: `specs/test-chat.md`.

- [ ] T29 Test chat. A web server route with TanStack AI and a small OpenRouter provider module, an MCP client to the gateway's own `/mcp`, two tools that wrap `search` and `execute`, and every tool call shown in the conversation.
- [ ] T30 First Playwright flow against the real server, a real database and the twins, with a scripted fake model endpoint. Adds the `e2e` script. Checkpoint: first end-to-end test.

## Deployment

- [ ] T31 Dockerfiles for `server` and `web`, the api, web and proxy services in Compose, and OpenTelemetry tracing with the optional trace viewer.
