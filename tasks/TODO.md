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
- [x] T05 Domain errors. Six domain errors with stable codes, `toDomainError()` for Prisma errors, and `DomainErrorFilter` registered with `APP_FILTER` (HTTP only; GraphQL comes with T07).
- [x] T06 User, catalog and connection models. `User`, `CatalogEntry` and `Connection` with citext display names and three check constraints, migration `20261121233730_connections`, and the seed for `me`.

## Connections

Spec: `specs/connections.md`.

- [ ] T07 GraphQL setup and the `connections` query. Code-first with the Apollo driver, `server/schema.gql` emitted and committed, a schema drift check in server `verify`, and a guard that attaches `me` as the caller. Adds `connection.model.ts` and `connection.resolver.ts` with every query filtered by owner (REQ-CONN-001), and the GraphQL branch of `DomainErrorFilter` (domain errors as GraphQL errors with `extensions.code`). Checkpoint: first GraphQL model and resolver. Human review: the guard.
- [ ] T08 Secret storage. `SecretStore` abstract class, AES-256-GCM implementation, key and key id from config, bound with a factory provider. Checkpoint: first interface with implementation and provider binding. Human review: encryption and key handling.
- [ ] T09 Custom connections. `createConnection`, `updateConnection`, `setConnectionEnabled` and `removeConnection`, with `connection.input.ts` validated by `class-validator`. Secrets are encrypted with `SecretStore`, and GraphQL returns only `hasApiKey` and `hasClientSecret`. Covers REQ-CONN-020 to 023, 040 to 044, 051 and 052. Checkpoint: first GraphQL input and mutation. Human review: credential storage.
- [ ] T10 Catalog. Seed entries for GitHub, Context7 and Azure DevOps once their values are confirmed (see the spec's open questions), OAuth client details for catalog entries from config, the `catalog` query and `switchOnCatalogEntry`. Covers REQ-CONN-010 to 012. Human review: credential handling.
- [ ] T11 Probe and credentials check. `probeServer` and `checkCredentials`, with the network rules for fetching. Covers REQ-CONN-060 to 063. Human review: fetching user-supplied URLs.
- [ ] T12 Server icons. MCP `icons`, then the favicon, then a generated letter icon; stored and served from our origin. Covers REQ-CONN-070 and 071. Human review: fetching upstream URLs.
- [ ] T13 Web GraphQL client. Apollo Client 4 through `@apollo/client-integration-tanstack-start`, GraphQL Code Generator reading `../server/schema.gql`, a `codegen` script, and a codegen drift check in web `verify`. Checkpoint: codegen setup.
- [ ] T14 Servers screen. First route, with the catalog section and "My servers" (REQ-CONN-080). `useConnections()` and `useCatalog()` in `src/hooks/`, shadcn components added with the shadcn CLI. Checkpoint: first route, first hook wrapper.
- [ ] T15 Add and edit dialogs. The add dialog with probe pre-fill and the credentials check, the edit form with write-only secret fields that show "Set" or "Not set", and remove with confirmation. Covers REQ-CONN-081 and 082.

## Upstream servers

Needs spec: `specs/upstreams.md`. Needs fake upstream MCP servers in `server/test/twins/`, which are human-owned.

- [ ] T16 Upstream registry. One singleton registry of `@modelcontextprotocol/client` clients for every enabled and `READY` connection. It connects in `onApplicationBootstrap` without blocking startup, follows enable, disable and removal, and closes clients in `onModuleDestroy`.
- [ ] T17 Live connection status. `EventBus` abstract class with a Redis implementation, a status subscription over `graphql-ws`, and a live badge in web.
- [ ] T18 Tool sync. A BullMQ job when a connection becomes enabled and `READY`, and on tool-list change: list tools, diff by content hash, store the tools. Adds a "re-sync tools" action.
- [ ] T19 Tool policy. An enabled flag per tool, set by the owner, with new tools enabled. MCP annotations are shown as labels and never enforced. Adds the tools screen per connection.
- [ ] T20 Upstream auth with an API key. `UpstreamAuthProvider` abstract class with the `NONE` and `API_KEY` implementations. Human review: credential handling.
- [ ] T21 Upstream auth with OAuth and dynamic client registration (`OAUTH_DCR`). Human review: OAuth flow, callback, token refresh, discovery URL fetching.
- [ ] T22 Upstream auth with OAuth and client details (`OAUTH_MANUAL`). Human review: OAuth flow.

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
