# Tasks

Work one task at a time, in order, each on its own branch. A task is done when `pnpm verify` passes in every project it touched.

- "Checkpoint" means the task introduces a new pattern. Stop after it for review, then record the approved pattern in `docs/conventions.md`.
- "Needs spec" means the task waits until the human has written that spec in `specs/`. The spec file names below are proposals.
- "Human review" means the task touches code listed under "Code the human always reviews" in `AGENTS.md`.

## Done

- [x] T00 Scaffold `server/` and `web/` with Biome, the cross-project import rule and `verify` scripts.
- [x] T01 Server config. `@nestjs/config` with a Zod schema and the `app` namespace (`HOST`, `PORT`), and `server/.env.example`. The server listens on `HOST`, default `127.0.0.1`.

## Foundation

- [ ] T02 Docker Compose for development data services: Postgres with `pgvector` and `pg_trgm`, and Redis. The api, web and proxy services come in T29. Checkpoint: Docker Compose file.
- [ ] T03 Prisma client. Add Prisma 7 pinned exactly, the `prisma-client` generator with an explicit `output`, a `PrismaModule` with one client on the `PrismaPg` adapter, and the `prisma` scripts from `server/AGENTS.md`. One database test against Postgres started by Testcontainers. Checkpoint: first Nest module, first database test.
- [ ] T04 Health checks. `HealthModule` with a liveness route and a readiness route that checks Postgres and Redis. Checkpoint: first HTTP controller.
- [ ] T05 Domain errors. The small set of domain errors, one Prisma error mapper, and one global filter registered with `APP_FILTER`. Checkpoint: error handling.

## Connections

Needs spec: `specs/connections.md`.

- [ ] T06 Connection model. Prisma model for an upstream connection (name, URL, auth mode, connection mode, enabled) and a migration created with `--create-only`. Checkpoint: first Prisma model and migration. Human review: migration.
- [ ] T07 GraphQL setup and the `connections` query. Code-first with the Apollo driver, `server/schema.gql` emitted and committed, and a schema drift check in server `verify`. Adds `connection.model.ts` and `connection.resolver.ts`. Checkpoint: first GraphQL model and resolver.
- [ ] T08 Secret storage. `SecretStore` abstract class, AES-256-GCM implementation, key and key id from config, bound with a factory provider. Checkpoint: first interface with implementation and provider binding. Human review: encryption and key handling.
- [ ] T09 Create, update and delete connections. `connection.input.ts` validated with `class-validator`. Secrets are encrypted with `SecretStore`, and GraphQL returns only whether a secret is set. Checkpoint: first GraphQL input and mutation. Human review: credential storage.
- [ ] T10 Web GraphQL client. Apollo Client 4 through `@apollo/client-integration-tanstack-start`, GraphQL Code Generator reading `../server/schema.gql`, a `codegen` script, and a codegen drift check in web `verify`. Checkpoint: codegen setup.
- [ ] T11 Connections list screen. First route, `useConnections()` in `src/hooks/`, shadcn components added with the shadcn CLI. Checkpoint: first route, first hook wrapper.
- [ ] T12 Connection forms. Create and edit forms with write-only secret fields that show "set" or "not set", and a delete action.

## Upstream servers

Needs spec: `specs/upstreams.md`. Needs fake upstream MCP servers in `server/test/twins/`, which are human-owned.

- [ ] T13 Upstream registry. One singleton registry of `@modelcontextprotocol/client` clients for remote HTTP servers. It connects in `onApplicationBootstrap` without blocking startup and closes clients in `onModuleDestroy`. Adds a "test connection" mutation.
- [ ] T14 Live connection status. `EventBus` abstract class with a Redis implementation, a status subscription over `graphql-ws`, and a live badge in web.
- [ ] T15 Tool sync. A BullMQ job on install and on tool-list change: list tools, diff by content hash, store the tools. Adds a "re-sync tools" action.
- [ ] T16 Tool policy. Enabled flag and class (read, write, destructive) per tool, pre-filled from MCP annotations, plus the connection mode. Adds the tools screen per connection.
- [ ] T17 Upstream auth with a token or header. `UpstreamAuthProvider` abstract class with the none and token implementations. Human review: credential handling.
- [ ] T18 Upstream auth with automatic OAuth. Human review: OAuth flow, callback, token refresh, discovery URL fetching.
- [ ] T19 Upstream auth with OAuth and manual client details. Human review: OAuth flow.
- [ ] T20 Server icons. The server's own `icons`, then a favicon, then a generated fallback. Fetch only from validated hosts, cap the size, check it is an image, store the bytes and serve them from our origin. Human review: fetching upstream URLs.

## Search

Needs spec: `specs/search.md`. The golden set lives in `scenarios/`.

- [ ] T21 Keyword search. `ToolDocumentBuilder` template v1, tool-name splitting, the `Retriever` abstract class with `PgFtsRetriever`, and `SearchFilter` as a required argument.
- [ ] T22 Vector search. `Embedder` with OpenRouter and a multilingual model, the `tool_embedding` table, re-embedding only on hash change, `PgVectorRetriever` with an exact scan, the Redis query-embedding cache, and the keyword-only fallback. Human review: migration.
- [ ] T23 Ranking. `Fuser` with reciprocal rank fusion (`k = 60`), a pass-through `Reranker`, exact tool-name matches first, and one log line per search. Run the golden set.
- [ ] T24 Example queries. `LlmClient` with OpenRouter, `ExampleQueryGenerator`, and roles mapped to models in config.

## MCP endpoint

Needs spec: `specs/mcp-endpoint.md`.

- [ ] T25 The `search` tool. `/mcp` with `@nestjs/mcp` pinned exactly, the guard with a default caller and team, and tests through `connectMcpClient`. Human review: the endpoint guard.
- [ ] T26 The `execute` tool. Look up the tool by id, check the policy, validate the arguments, forward to the upstream, and return failures as results with `isError: true`. Human review: permission check.

## Test chat

Needs spec: `specs/test-chat.md`.

- [ ] T27 Test chat. A web server route with TanStack AI and a small OpenRouter provider module, an MCP client to the gateway's own `/mcp`, two tools that wrap `search` and `execute`, and every tool call shown in the conversation.
- [ ] T28 First Playwright flow against the real server, a real database and the twins, with a scripted fake model endpoint. Adds the `e2e` script. Checkpoint: first end-to-end test.

## Deployment

- [ ] T29 Dockerfiles for `server` and `web`, the api, web and proxy services in Compose, and OpenTelemetry tracing with the optional trace viewer.
