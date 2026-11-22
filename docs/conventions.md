# Conventions

Each section records a pattern the human approved. Follow it exactly. If a task does not fit a pattern here, stop and ask.

## Project scaffold

Approved 2026-11-21.

### Generate code with the framework CLIs

Create NestJS files with the Nest CLI and shadcn/ui files with the shadcn CLI. Do not write these files by hand. Edit a generated file only where the task needs it.

```bash
pnpm exec nest g module upstreams     # in server/
pnpm dlx shadcn@latest add button     # in web/
```

### Package names

The server package is `onedoor-server` and the web package is `onedoor-web`. Each project has its own `package.json` and `pnpm-lock.yaml`. There is no root `package.json` and no pnpm workspace. `web/pnpm-workspace.yaml` holds pnpm settings only (`allowBuilds`) and must never declare `packages:`.

### Versions

Use the latest version of each dependency, with these exceptions:

- TypeScript stays on the newest 6.x, the major NestJS 12 supports. Do not install TypeScript 7.
- `@biomejs/biome` is pinned exactly, to the same version in both projects. The root `biome.json` `$schema` URL names that version, so update all three together.
- `nitro` is a prerelease and is pinned exactly.
- `prisma`, `@prisma/client`, `@prisma/adapter-pg` and `@nestjs/mcp` are pinned exactly, as the root AGENTS.md says.
- Never leave a `"latest"` string in `package.json`.

### Biome layout

The root `biome.json` sets `"root": true` and holds the shared settings. `server/biome.json` and `web/biome.json` start with `"extends": "//"` and hold only what differs for their project.

The rule that blocks imports between the projects lives in each nested config, because root `overrides` keyed on `server/**` or `web/**` do not match once nested configs exist:

```json
"noRestrictedImports": {
  "level": "error",
  "options": {
    "patterns": [
      {
        "group": ["**/../**/web", "**/../**/web/**", "/**/web", "/**/web/**", "web", "web/**", "onedoor-web", "onedoor-web/**"],
        "message": "server must not import from web. The only contract is server/schema.gql."
      }
    ]
  }
}
```

The root config turns on `style.noCommonJs`, because `noRestrictedImports` patterns do not match `require()` in Biome 2.6.

Biome does not check Markdown, `.agents/`, `.claude/`, build output, `routeTree.gen.ts` or `schema.gql`.

### Formatting

- Indentation is 2 spaces in both projects.
- `server/` uses single quotes, the style `nest g` writes.
- `web/` uses double quotes and semicolons only where needed, the style `shadcn add` writes.

After you generate a file, run `pnpm exec biome check --write <file>` in its project.

### Lint rules that differ per project

- `server/biome.json` turns off `style.useImportType`. Its fix rewrites injected classes as `import type`, which removes the runtime value that Nest dependency injection reads from decorator metadata. Biome's rule documentation recommends disabling it for NestJS.
- `server/biome.json` sets `javascript.parser.unsafeParameterDecoratorsEnabled`, so Biome parses Nest parameter decorators such as `@Body()`.
- `web/biome.json` sets `css.parser.tailwindDirectives`, so Biome parses Tailwind v4 directives in `src/styles.css`.

### Scripts

Both projects have `dev`, `lint`, `typecheck`, `test` and `verify`. `lint` is `biome check --error-on-warnings .`, so a warning fails the gate.

| Project | `verify` runs |
|---|---|
| server | `lint`, `typecheck`, `test`, `test:e2e` |
| web | `lint`, `generate-routes`, `check-routes`, `typecheck`, `test` |

`check-routes` runs `git diff --exit-code -- src/routeTree.gen.ts`. It fails when the committed route tree is stale. Commit `src/routeTree.gen.ts`.

Add a new drift check to `verify` in the same way when a new generated file is committed, for example `server/schema.gql` or the web GraphQL codegen output.

### Ports

The server listens on 3000 and the web dev server on 3001.

### Path aliases in web

shadcn writes imports with the `#/` alias (`#/components`, `#/lib/utils`, `#/hooks`), which maps to `web/src/`. Use `#/` in hand-written web code too.

## Server config

Approved 2026-11-21.

Each area of config is one namespace in `server/src/config/<area>.config.ts`. The file exports a Zod schema named `<area>EnvSchema` for the environment variables the area owns, and a `registerAs('<area>')` factory named `<area>Config`. The factory parses `process.env` with the schema and returns typed values with camelCase keys:

```ts
export const appEnvSchema = z.object({
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
});

export const appConfig = registerAs('app', () => {
  const env = appEnvSchema.parse(process.env);
  return { host: env.HOST, port: env.PORT };
});
```

The factory parses the schema itself because `@nestjs/config` hands `registerAs` factories the raw `process.env` strings.

To add a namespace:

1. Write `<area>.config.ts` and `<area>.config.spec.ts`. The spec covers the defaults, the coercion and at least one rejected value.
2. Spread the schema into `envSchema` in `server/src/config/env.schema.ts`. `ConfigModule` validates `envSchema` at startup, so an invalid value stops the boot.
3. Add the factory to `load` in `ConfigModule.forRoot` in `app.module.ts`.
4. Add every variable to `server/.env.example` under a `# <area>:` comment. Secrets get an empty value.

Read config by injecting the namespace, never with `process.env` or a string key on `ConfigService`:

```ts
constructor(
  @Inject(appConfig.KEY) private readonly app: ConfigType<typeof appConfig>,
) {}
```

In `main.ts`, use `app.get<ConfigType<typeof appConfig>>(appConfig.KEY)`.

Unit tests set variables with `vi.stubEnv` and restore them with `vi.unstubAllEnvs` in `afterEach`.

## Docker Compose

Approved 2026-11-21.

`/docker-compose.yml` sets `name: onedoor`. Every service in it follows these rules:

- Pin the image to an exact version tag, such as `pgvector/pgvector:0.8.7-pg19-trixie` or `redis:8.8.4-alpine`. Never use `latest` or a bare major.
- Publish ports on `127.0.0.1` only, for example `"127.0.0.1:5432:5432"`.
- Keep data in a named volume. For Postgres 18 and later, mount it at `/var/lib/postgresql`, not `/var/lib/postgresql/data`.
- Give the service a healthcheck, so `docker compose up -d --wait` returns only when it is ready.
- Set `restart: unless-stopped`.

Secrets come from the root `.env`, which Compose reads and git ignores. A required secret uses `${NAME:?message}`, so Compose refuses to start without it. A non-secret uses `${NAME:-default}`. List every variable in the root `.env.example`, with secrets left empty:

```yaml
POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:?Set POSTGRES_PASSWORD in .env, see .env.example}
POSTGRES_USER: ${POSTGRES_USER:-onedoor}
```

Redis runs with `--maxmemory-policy noeviction --appendonly yes`, which BullMQ requires.

Postgres extensions (`vector`, `pg_trgm`) are not created by Compose. Migration SQL creates them.

Start the services with `docker compose up -d --wait` and stop them with `docker compose down`. Use `docker compose down -v` only when you mean to delete the data.

## Prisma client and Nest modules

Approved 2026-11-21.

### Prisma

- `prisma`, `@prisma/client` and `@prisma/adapter-pg` are pinned exactly to the same 7.x version. npm `latest` points at Prisma 8, so always name the version: `pnpm add --save-exact @prisma/client@7.10.1`.
- `server/prisma/schema.prisma` and `server/prisma7.config.ts` came from `prisma init`. The config loads `server/.env` with `dotenv/config`, because the Prisma 7 CLI does not read `.env` itself.
- The `prisma-client` generator writes to `server/src/generated/prisma`. Git ignores that folder, so Biome does not lint it. Import the client from `../generated/prisma/client.js`.
- `postinstall` runs `prisma generate`. `migrate dev` does not regenerate the client in Prisma 7, so run `pnpm prisma generate` after every schema change.
- `server/pnpm-workspace.yaml` holds pnpm settings only. Its `allowBuilds` lets `@prisma/engines` and `prisma` run their install scripts and denies the rest.

### PrismaService

`PrismaService` is the one Prisma client. It extends `PrismaClient`, takes its URL from the `database` config namespace, and uses the `PrismaPg` adapter:

```ts
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(
    @Inject(databaseConfig.KEY) database: ConfigType<typeof databaseConfig>,
  ) {
    super({ adapter: new PrismaPg({ connectionString: database.url }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

It does not call `$connect()` at startup. The first query opens the pool, so the server starts while Postgres is down. `main.ts` calls `app.enableShutdownHooks()`, so `onModuleDestroy` runs on SIGTERM.

Feature modules import `PrismaModule` and inject `PrismaService`. Never construct another `PrismaClient`.

### Nest modules

Generate a module and its service with the Nest CLI, then edit only what the task needs:

```bash
pnpm exec nest g module prisma
pnpm exec nest g service prisma
```

The CLI adds the module to `AppModule`. A module lists its providers and exports only what other modules inject. Modules are not `@Global()`; `ConfigModule` is the one global module.

### Database tests

A database test starts its own Postgres with Testcontainers, using the same image tag as `docker-compose.yml`. It never uses the Compose database. It sits next to the code as `<name>.spec.ts`, so `pnpm test` needs Docker running.

```ts
beforeAll(async () => {
  container = await new PostgreSqlContainer(POSTGRES_IMAGE).start();
  vi.stubEnv('DATABASE_URL', container.getConnectionUri());
  moduleRef = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [databaseConfig] }),
      PrismaModule,
    ],
  }).compile();
  prisma = moduleRef.get(PrismaService);
}, 120_000);

afterAll(async () => {
  await moduleRef?.close();
  await container?.stop();
  vi.unstubAllEnvs();
});
```

`ignoreEnvFile: true` keeps `server/.env` out of the test. Give `beforeAll` a timeout of 120 seconds, because the first run pulls the image.

## HTTP controllers and health checks

Approved 2026-11-21.

### HTTP controllers

Plain HTTP routes are few: health checks, the OAuth callback and icons. GraphQL serves everything else. They live in `HttpApiModule` (`server/src/api/http/`), one folder per area. Generate the controller and any helper provider with the Nest CLI:

```bash
pnpm exec nest g controller api/http/health --no-spec
pnpm exec nest g provider api/http/health/redis.health --flat --no-spec
```

The CLI adds the controller to `HttpApiModule`; add a provider yourself. Logic the controller needs comes from a service module, as `IconsController` uses `IconsService` from `services/icons`.

A controller has one `@Controller('<area>')` prefix and methods that only delegate. Delete the controller spec that `nest g controller` writes; an e2e test covers the routes.

### Health checks

The health checks use `@nestjs/terminus`, which `HttpApiModule` imports:

- `GET /health/live` runs `health.check([])`. It checks no dependencies, so an outage does not get the process restarted.
- `GET /health/ready` checks every hard dependency and answers 503 when one is down. Postgres uses Terminus's `PrismaHealthIndicator` with `PrismaService`. Redis uses `RedisHealthIndicator`.
- Every check has a timeout of 1 second.

A custom indicator uses `HealthIndicatorService`:

```ts
isHealthy<Key extends string>(key: Key) {
  return this.healthIndicatorService
    .check(key)
    .attempt(async () => {
      await this.client.ping();
    })
    .withTimeout(1000);
}
```

`RedisHealthIndicator` owns one ioredis client with `maxRetriesPerRequest: 1`, logs the first connection error per outage, and calls `disconnect()` in `onModuleDestroy`.

### Config with a non-secret default

A variable with no secret in its default value gets a `.default()` and the same value in `.env.example`, like `REDIS_URL=redis://127.0.0.1:6379`. The schema restricts the URL scheme, for example `z.url({ protocol: /^rediss?$/ })`.

### End-to-end tests

An e2e test lives in `server/test/<area>.e2e-spec.ts`. It starts the services it needs with Testcontainers, using the image tags from `docker-compose.yml`. It stubs their URLs, then imports `AppModule` dynamically, so config validation sees the containers and not `server/.env`:

```ts
beforeAll(async () => {
  [postgres, redis] = await Promise.all([
    new PostgreSqlContainer(POSTGRES_IMAGE).withPassword(password).start(),
    new RedisContainer(REDIS_IMAGE).start(),
  ]);
  vi.stubEnv('DATABASE_URL', postgres.getConnectionUri());
  vi.stubEnv('REDIS_URL', redis.getConnectionUrl());

  const { AppModule } = await import('../src/app.module.js');
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
}, 120_000);
```

Call routes with `supertest` on `app.getHttpServer()`. Close the app before stopping the containers. A test that touches credentials starts Postgres with a random password and asserts that the response does not contain it.

## Errors

Approved 2026-11-22.

### Domain errors

Services throw only the errors in `server/src/errors/domain-errors.ts`. Each has a stable `code`, and its message is safe to show a client. Details for the log go in `cause`.

| Error | `code` | HTTP |
|---|---|---|
| `NotFoundError` | `NOT_FOUND` | 404 |
| `ConflictError` | `CONFLICT` | 409 |
| `ForbiddenError` | `FORBIDDEN` | 403 |
| `ValidationError` | `VALIDATION` | 400 |
| `UpstreamUnavailableError` | `UPSTREAM_UNAVAILABLE` | 502 |
| `InternalError` | `INTERNAL` | 500 |

```ts
throw new NotFoundError('Connection not found');
throw new UpstreamUnavailableError('GitHub is unreachable', { cause: error });
```

Do not add a new error class or code without asking.

### Prisma errors

Every Prisma call in a service sits in a `try` block whose `catch` throws `toDomainError(error, '<Resource>')` from `server/src/prisma/prisma-error.mapper.ts`:

```ts
try {
  return await this.prisma.connection.create({ data });
} catch (error) {
  throw toDomainError(error, 'Connection');
}
```

It maps P2002 and P2003 to `ConflictError`, P2025 to `NotFoundError` and P2000 to `ValidationError`. It returns a domain error unchanged and turns anything else into `InternalError` with the original as `cause`. Map a new Prisma code in this one function, with a test in `prisma-error.mapper.spec.ts`.

Catch a unique violation instead of checking for a duplicate first.

### The global filter

`DomainErrorFilter` is the one global filter, registered in `AppModule` as `{ provide: APP_FILTER, useClass: DomainErrorFilter }`. For HTTP:

- A `DomainError` gets its status and the body `{ statusCode, code, message }`.
- An `HttpException` passes through unchanged. Validation pipes, guards, Terminus and Nest's unknown-route 404 throw these.
- Anything else is logged with its stack and answered as `INTERNAL` with the message "Internal server error".

For GraphQL, see the GraphQL section. MCP tool errors do not use the filter; they are returned as results with `isError: true`.

An e2e test for an error path boots `AppModule` with a test-only controller, so it goes through the real filter registration (see `server/test/errors.e2e-spec.ts`).

## Prisma models, migrations and seed

Approved 2026-11-22.

### Models

- Models are PascalCase and fields camelCase. Tables and columns are snake_case in the database, mapped with `@@map` and `@map`. Enums are mapped too: `@@map("auth_type")`.
- Ids are `String @id @default(uuid(7)) @db.Uuid`.
- Timestamps are `@db.Timestamptz(3)`: `createdAt` with `@default(now())`, `updatedAt` with `@updatedAt`.
- Text that is unique regardless of case is `@db.Citext`, with the extension created in the migration.
- Every owned model has `ownerId` pointing to `User`, and each `@@unique` that should hold per user starts with `ownerId`.
- Give each model and each non-obvious field a `///` comment that names the requirement it serves.

```prisma
model Connection {
  id          String  @id @default(uuid(7)) @db.Uuid
  ownerId     String  @map("owner_id") @db.Uuid
  owner       User    @relation(fields: [ownerId], references: [id], onDelete: Cascade)
  /// Unique per owner, ignoring case (citext).
  displayName String? @map("display_name") @db.Citext

  @@unique([ownerId, displayName])
  @@map("connection")
}
```

### Migrations

1. Change `prisma/schema.prisma`.
2. Run `pnpm prisma migrate dev --create-only --name <name>`, with the name in snake_case.
3. Add by hand what Prisma 7 cannot express: extensions, check constraints, and later the vector and full-text columns. Put a comment above each addition that says why and names the requirement.
4. Apply it locally with `pnpm prisma migrate dev`. Then run `pnpm prisma migrate dev --create-only --name drift_probe`. It must create an empty migration, which you delete. A non-empty one means Prisma would undo a hand-written addition.
5. Run `pnpm prisma generate`.
6. Flag the migration for human review in the PR.

Name a check constraint `<table>_<rule>_check`. Never edit a migration after it is merged; write a new one.

When `migrate dev` stops at a confirmation prompt (for example for a new unique constraint) in a shell that is not interactive, write the migration from the diff instead, against a dev database that has every migration applied:

```bash
dir=prisma/migrations/$(date -u +%Y%m%d%H%M%S)_<name> && mkdir "$dir"
pnpm exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > "$dir/migration.sql"
pnpm exec prisma migrate deploy
```

Remove the `Loaded Prisma config` line from the file if the CLI prints it. The drift probe is then `migrate diff` again: it must print an empty migration.

A child row whose owner must match its parent's owner uses a composite foreign key: the parent gets `@@unique([id, ownerId])`, and the child's relation uses `fields: [parentId, ownerId], references: [id, ownerId]`. `Tool` does this for `Connection`.

### Seed

`prisma/seed.ts` creates the rows every environment needs, with `upsert` so it can run any number of times. It exports `seed(prisma)` for tests and runs itself only under `import.meta.main`. Run it with `pnpm prisma db seed`.

The catalog of pre-installed servers is the `CATALOG` array in `prisma/seed.ts`. Each entry and auth option is upserted by its key and auth type; the seed never deletes one. Before adding or changing a catalog value (URL, auth type, header settings), check it against the vendor's current documentation and note the date in the comment above `CATALOG`. Secrets, such as OAuth client details, never go in the seed; they come from server config.

### Database tests against the migrations

A test that needs the real schema starts its database with `startMigratedPostgres()` from `server/test/support/database.ts`, which runs `prisma migrate deploy` on a Testcontainers Postgres. Call `seed(prisma)` when the test needs the seeded rows.

Assert a rejected check constraint by its name, and a Prisma error by the domain error `toDomainError` makes of it:

```ts
await expect(create()).rejects.toThrow(/connection_catalog_or_custom_check/);
expect(toDomainError(error, 'Connection')).toBeInstanceOf(ConflictError);
```

## Server layers

Approved 2026-11-22.

`server/src` is split by layer:

```text
server/src/
├── api/
│   ├── graphql/        GraphqlApiModule: GraphQLModule and every resolver, one folder per feature
│   ├── http/           HttpApiModule: plain HTTP controllers (health/, icons/)
│   ├── mcp/            later: the MCP endpoint
│   └── validation/     class-validator decorators for API inputs
├── auth/               CallerModule: the caller identity and CallerGuard
├── services/
│   ├── upstreams/      UpstreamsModule: one folder per feature (connections/, catalog/, probe/, icon-refresh/)
│   └── icons/          IconsModule
└── config/ crypto/ errors/ net/ prisma/   shared
```

- Imports go one way: `api` imports `services` and `auth`, and `services` imports the shared folders. `services` and `auth` never import from `api`.
- A service module provides and exports services only. An API module imports the service modules it needs and provides the resolvers or controllers.
- `AppModule` imports `PrismaModule`, `CallerModule` and the API modules. Service modules come in through the API modules.
- Services take and return plain types defined in `services/<module>/<feature>/<name>.interface.ts` (generate with `nest g interface <path> --flat`). Enums that GraphQL shows are `as const` objects in the same file.
- In a service, import Prisma's row types under a `Record` suffix (`Connection as ConnectionRecord`), so they do not clash with the service types.
- Auth to upstream servers (API keys, OAuth to GitHub and others) belongs to `services/upstreams`. `auth/` is only about who calls OneDoor.

## GraphQL

Approved 2026-11-22.

### Setup

`GraphqlApiModule` configures code-first GraphQL on Apollo at `/graphql`. The schema is built in memory (`autoSchemaFile: true`), sorted, and stack traces never reach clients. The context is a function, `({ req }) => ({ req })`, so each request has its own caller.

### The committed schema

`server/schema.gql` is the contract with `web`. `test/schema.e2e-spec.ts` builds the schema from the real `AppModule` and compares it with the file, so `pnpm test:e2e`, and with it `pnpm verify`, fails on drift. After any schema change, run `pnpm generate-schema` and commit `schema.gql`.

In tests, load `graphql` with `createRequire(import.meta.url)('graphql')` when the code reads a schema or values that Nest built. A plain `import` gives Vitest a second copy of `graphql`.

### Files per feature

Approved 2026-11-22. A feature has one folder in `api/graphql/` and one in its service module, with GraphQL classes split by kind:

```text
server/src/
├── api/graphql/
│   ├── graphql-api.module.ts
│   └── connections/
│       ├── connections.query.ts       ConnectionsQuery: @Query methods
│       ├── connections.mutation.ts    ConnectionsMutation: @Mutation methods
│       ├── inputs/
│       │   ├── create-connection.input.ts   CreateConnectionInput implements CreateConnectionData
│       │   └── update-connection.input.ts
│       └── models/
│           └── connection.model.ts          ConnectionModel implements Connection
└── services/upstreams/
    ├── upstreams.module.ts
    └── connections/
        ├── connection.interface.ts    Connection, CreateConnectionData, UpdateConnectionData, SetupState
        ├── connections.service.ts
        ├── connection.mapper.ts
        └── connection-rules.ts (+ .spec.ts)
```

Generate the files with the Nest CLI, then fill them in. `nest g class` names the class after the file, so `connections.query` becomes `ConnectionsQuery`:

```bash
pnpm exec nest g interface services/upstreams/connections/connection --flat
pnpm exec nest g service services/upstreams/connections/connections --flat --no-spec
pnpm exec nest g class api/graphql/connections/models/connection.model --flat --no-spec
pnpm exec nest g class api/graphql/connections/inputs/create-connection.input --flat --no-spec
pnpm exec nest g class api/graphql/connections/connections.query --flat --no-spec
pnpm exec nest g class api/graphql/connections/connections.mutation --flat --no-spec
```

- One class per file.
- `models/<name>.model.ts`: the `@ObjectType('<Name>')` class, named `<Name>Model` in TypeScript, that `implements` the service type. Every field has `@Field`; nullable and enum fields give their type, as in `@Field(() => String, { nullable: true })`. Describe fields that are not obvious, and name the requirement.
- `inputs/<name>.input.ts` (`@InputType`) and `inputs/<name>.args.ts` (`@ArgsType`), each implementing the service's data type.
- `<feature>.query.ts`: `@Resolver(() => <Name>Model) class <Feature>Query` with only `@Query` methods. `<feature>.mutation.ts` is the same for `@Mutation`, and `<feature>.subscription.ts` for `@Subscription`. A feature without queries has no query file. A resolver with no object type, such as `ProbeMutation`, uses `@Resolver()`.
- `<name>.resolver.ts` holds only `@ResolveField` methods of an object type. Generate it with `nest g resolver <path> --flat --no-spec`.
- Every query, mutation and subscription has a `description`. Methods only delegate to the service and return its result as it is.
- `<feature>.service.ts`: the logic. It reads with Prisma, catches with `toDomainError`, and maps rows to the service types (in the service or in `<name>.mapper.ts`). It never returns a Prisma type.
- A feature folder may import another feature's types, models and rules, as `catalog/` imports `Connection` and `ConnectionModel`.
- `nest g service` adds the service to its module's `providers`; add it to `exports` too. `nest g class` registers nothing, so add each resolver class to `GraphqlApiModule`'s `providers`.

Register an enum for GraphQL with `registerEnumType` in the model file that uses it: a Prisma enum, or an `as const` enum from a service type file.

### The caller

`CallerModule` registers `CallerGuard` as `APP_GUARD`. It attaches the caller to every GraphQL request; plain HTTP routes pass through. Every resolver method that reads or writes owned data takes `@CurrentCaller() caller: Caller` and passes `caller.userId` to the service:

```ts
@Query(() => [ConnectionModel], {
  description: "The caller's connections, sorted by display name.",
})
connections(@CurrentCaller() caller: Caller): Promise<ConnectionModel[]> {
  return this.connectionsService.listForOwner(caller.userId);
}
```

The service filters by owner in the Prisma query. A row of another owner, an unknown id and an id that is not a UUID all throw `NotFoundError`.

### Errors

`DomainErrorFilter` turns a domain error into a GraphQL error with `extensions.code` (for example `NOT_FOUND`), and an unknown error into `INTERNAL` with the message "Internal server error". Resolvers throw domain errors and nothing else.

### Tests

A resolver test is an e2e test: it starts a migrated Postgres, seeds it, writes rows with its own `PrismaClient`, boots `AppModule`, and posts queries to `/graphql` with `supertest`. It asserts `errors[0].extensions.code` for failures. A test with no database overrides `CallerService` with `{ getDefaultCaller: async () => ({ userId: 'test' }) }`.

## Interfaces and provider bindings

Approved 2026-11-22.

### Shape

Each replaceable part (server/AGENTS.md, Interfaces) is an abstract class in its module folder. The abstract class is the injection token, and feature code imports only it.

```text
server/src/crypto/
├── secret-store.ts            abstract class SecretStore, plus the types it uses
├── aes-gcm-secret-store.ts    class AesGcmSecretStore extends SecretStore
└── crypto.module.ts           the factory provider
```

- The abstract class has an `abstract readonly id` (or `version`) for logs, and a comment on each method that says what it guarantees, including what it throws.
- Methods that may call out to another system later are `async`, even when the first implementation is synchronous.
- An implementation takes plain values in its constructor, not config objects or Nest tokens, so a unit test can build it with `new`.
- Generate the module and classes with the Nest CLI (`nest g module`, `nest g class <module>/<name> --flat --no-spec`), then fill them in.

### Binding

The module binds the abstract class with a factory provider that reads the area's config namespace. A config value with one enum member per implementation selects it:

```ts
{
  provide: SecretStore,
  inject: [cryptoConfig.KEY],
  useFactory: (crypto: ConfigType<typeof cryptoConfig>): SecretStore => {
    switch (crypto.secretStore) {
      case 'aes-256-gcm':
        return new AesGcmSecretStore(crypto.key, crypto.keyId);
    }
  },
}
```

The config schema lists the allowed values with `z.enum([...])` and a default, so an unknown value stops the boot. The module exports only the abstract class.

### Tests

- The implementation has a unit test that builds it with `new`.
- The module has a test that compiles it with `ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true, load: [<area>Config] })` and checks that the abstract class resolves to the configured implementation.

### Secrets

- Feature code encrypts with `secretStore.encrypt(plaintext, context)` and stores both `ciphertext` and `keyId`. `context` names where the value is stored: `<table>:<row id>:<field>`, for example `connection:<id>:api_key`.
- `SECRET_STORE_KEY` is 32 random bytes in base64 (`openssl rand -base64 32`). Changing it makes every stored secret unreadable.

### Required variables in e2e tests

An e2e test that boots `AppModule` calls `stubAppEnv()` from `server/test/support/env.ts` before importing it, passing the URLs of the services it started. A new required variable gets a test value in `stubAppEnv()`.

## GraphQL inputs and mutations

Approved 2026-11-22.

### Validation

`AppModule` registers `createValidationPipe()` from `server/src/errors/validation-pipe.ts` as `APP_PIPE`. It transforms inputs into their classes, rejects undeclared fields, and turns failures into a domain `ValidationError`, so clients get `extensions.code: VALIDATION`. Its messages name the field and the rule, never the value.

### Input classes

`inputs/create-<name>.input.ts` holds `Create<Name>Input`, and `inputs/update-<name>.input.ts` holds `Update<Name>Input`. Both are `@InputType` with a `description`. Every field has `@Field` and class-validator decorators:

- A required string: `@IsString()` and a length rule. Trim names with `@Trim()` from `api/validation/validators.ts`.
- An optional field that may be null: `@IsOptional()`.
- An update field that may be left out but not set to null: `@IfGiven()` before the rules.
- A rule that needs code is a function in the service's `<name>-rules.ts` that returns the problem as text, or null. Test the functions in `<name>-rules.spec.ts`. Its decorator, made with `registerDecorator`, lives in `api/validation/validators.ts`. The message never repeats the value.

Rules that compare fields (one field required when another has a value) live in the service and throw `ValidationError`.

### Update semantics

In an update input, a field left out keeps its value. For a nullable field, `null` clears it. A secret field follows the same rule: left out keeps, `null` deletes, a string replaces.

### Mutations

- One resolver method per mutation, with a `description` that names the requirement. It takes `@CurrentCaller()` and delegates.
- A mutation returns the changed object. A removal returns the removed id as `ID`.
- The service writes with `where: { id, ownerId }`, so another owner's row is a Prisma P2025 and becomes `NOT_FOUND`. Check that the id is a UUID first.
- Keep transactions to database work and local computation such as encryption. Never call another system inside one.

### Secrets in a row

- A secret column pair is `<field>Ciphertext` and `<field>KeyId`, with a check constraint that both are set or both are null.
- Encrypt with the context `<table>:<row id>:<field>`. A new row is inserted first without its secrets, then updated with them, inside one transaction.
- GraphQL exposes `has<Field>: Boolean!`, never the value.
- The e2e test checks every response for the secret's plaintext, and that the stored ciphertext decrypts only with its own row's context.

## Fetching other hosts

Approved 2026-11-22.

### GuardedFetch

Every request to a URL that a user or an upstream server supplies goes through `GuardedFetch` from `NetModule` (`server/src/net/`). That covers MCP transports, OAuth metadata and icons. Never call `fetch`, `undici` or `http` directly for such a URL.

```ts
const fetch = this.guardedFetch.create({ sensitiveHeaders: [headerName] });
const transport = new StreamableHTTPClientTransport(new URL(url), {
  fetch,
  requestInit: { headers },
});
```

It applies REQ-CONN-063: the URL rule from `url-policy.ts`, the address rules from `address-policy.ts` at connect time, at most three redirects with credential headers dropped across origins, and a 1 MB body cap. Pass the name of any custom credential header in `sensitiveHeaders`.

A refused request throws `NetworkRuleError`; fetch may wrap it, so find it with `findNetworkRuleError(error)`.

### Results the client sees

Code that reports on another host returns fixed messages that it writes itself. An upstream's error text, status text or response body never reaches the client, so it cannot carry a secret or untrusted text back.

Give every outgoing call a deadline with `AbortSignal.timeout(...)`, combined with the caller's signal through `AbortSignal.any`.

### Tests

- Fake upstream servers live in `server/test/twins/`, which is human-owned. Add or change a twin only with the owner's permission, and say so in the PR.
- A twin is a `start<Name>Twin()` function that listens on 127.0.0.1 on a free port and returns `{ url, origin, close }`. MCP twins serve Streamable HTTP statelessly with `@modelcontextprotocol/server` and `@modelcontextprotocol/node`.
- Tests of the network rules construct `GuardedFetch` with a fake resolver (`ResolveAll`), so no test depends on real DNS or reaches the internet.
- A test that sends a secret asserts that no response contains it.

## Background work and served files

Approved 2026-11-22.

### Work that reaches other hosts

A request never waits for another host when the result can arrive later. Start the work from the service with a `...InBackground` method that catches and logs its own errors, and return at once:

```ts
refreshConnectionInBackground(connectionId: string, url: string): void {
  if (!this.icons.fetching) return;
  this.refreshConnection(connectionId, url).catch((error: unknown) =>
    this.logger.warn(`Icon refresh failed for connection ${connectionId}: ${String(error)}`),
  );
}
```

- When the work writes its result back, the write checks that its input is still current, for example `updateMany({ where: { id, url } })`, so a slow run cannot overwrite a newer one.
- Work at startup runs from `onApplicationBootstrap` without `await`, so startup does not block.
- A config switch turns off work that reaches the network. `stubAppEnv()` turns it off, and the test of that feature turns it back on. `ICON_FETCHING` and `UPSTREAM_CONNECTING` are the switches so far.
- Work that must survive a restart or be retried goes on a BullMQ queue instead (see "Queues"). The `...InBackground` method then only adds the job.

### Files served from OneDoor's own origin

Content that came from another host, such as icons, is stored and served by OneDoor, never linked. A route that serves it sets `X-Content-Type-Options: nosniff` and `Content-Security-Policy: default-src 'none'; style-src 'unsafe-inline'`, and takes the content type from what OneDoor detected in the bytes.

## Upstream clients

Approved 2026-11-22.

### The registry

`UpstreamRegistryService` in `server/src/services/upstreams/registry/` owns every upstream MCP client. No other code opens a long-lived client. Probes and credential checks open a short-lived client of their own and close it.

- One client per connection that is enabled, `READY` and has auth type `NONE`. Connections with credentials join when `UpstreamAuthProvider` exists.
- `onApplicationBootstrap` starts a sync for every enabled connection without `await`. `onModuleDestroy` aborts and closes every client.
- `client(connectionId)` returns the connected client, or `undefined` while it connects, after a failed connect, and when the connection should have none.
- Clients connect through `GuardedFetch` with a 10 second connect timeout. One `AbortController` per client stops all of its requests when the client closes.
- A failed connect is logged with the connection id and a fixed reason. It leaves no client and the status `FAILED`, and the next sync tries again.
- `status(connectionId)` returns `OFF`, `CONNECTING`, `CONNECTED` or `FAILED` from memory. Each change publishes `CONNECTION_STATUS_CHANGED` with the connection id and owner id, from a background call that only logs a failure. A removed connection publishes nothing.
- `UPSTREAM_CONNECTING` turns the registry off. `stubAppEnv()` and the web e2e setup set it to `false`.

### Following changes

A service that writes a connection row calls the registry after the write, and returns without waiting:

```ts
await this.prisma.connection.update({ where: { id, ownerId }, data: { enabled } });
this.registry.syncInBackground(id);
```

`sync(id)` reads the row again and decides: keep the client when the URL is the same, otherwise close it and open a new one when one is wanted. Syncs of one connection decide in the order they were asked for, so the last write wins. A sync never takes its input from the caller, only from the row.

### Tests

The registry test is `server/test/upstream-registry.e2e-spec.ts`. It sets `UPSTREAM_CONNECTING=true` and uses the open twin. It waits for a background change with `vi.waitFor` on `registry.client(id)`, and calls `await registry.sync(id)` where the test itself made the change.

## Queues

Approved 2026-11-22.

### Setup

`QueueModule` in `server/src/queue/` sets up BullMQ on `REDIS_URL` with `manualRegistration`. A service module imports `QueueModule` and registers its own queues:

```ts
imports: [QueueModule, BullModule.registerQueue({ name: TOOL_SYNC_QUEUE })],
```

Workers start only when a service calls `BullRegistrar.register()` in `onModuleInit`, behind the config switch of the work (`UPSTREAM_CONNECTING` for tool sync). Without workers no Redis is needed, which keeps tests that do not start Redis quiet. A test that turns a switch on starts Redis in Testcontainers.

### Files per queue

```text
services/upstreams/tool-sync/
├── tool-sync.service.ts     TOOL_SYNC_QUEUE, ToolSyncJob, ToolSyncService.syncInBackground(), registers workers
└── tool-sync.processor.ts   @Processor(TOOL_SYNC_QUEUE) ToolSyncProcessor extends WorkerHost
```

- The service exports the queue name and the job data type, and adds jobs from a `...InBackground` method that logs a failure to queue and returns at once.
- Job data holds ids only. The processor loads what it needs.
- The processor only delegates to services and logs one line per job with what it changed.
- Jobs that reach another host use `attempts: 3`, `backoff: { type: 'exponential', delay: 1_000 }`, `removeOnComplete: true` and `removeOnFail: 100`.
- A job is idempotent, so a repeated job is harmless. Deduplicate only when a job that is already running cannot miss the change that queued the next one.
- Write results so that a failed job leaves the stored state as it was.

### Tests

An e2e test starts Postgres and Redis, sets the switch, and waits for the job's effect in the database with `vi.waitFor`. After adding a queue, stop its worker from registering once and see the tests fail.

## Events and subscriptions

Approved 2026-11-22.

### EventBus

`EventBus` in `server/src/events/` is the abstract class, bound by `EventsModule` on `EVENT_BUS` (only `redis` so far, which uses `REDIS_URL`). A service module that publishes or subscribes imports `EventsModule`. The API layer never injects `EventBus`: a service wraps the subscription it needs.

A topic is a typed constant, defined next to the payload type in the service's `<name>.interface.ts`:

```ts
export interface ConnectionStatusChanged {
  connectionId: string;
  ownerId: string;
}
export const CONNECTION_STATUS_CHANGED = defineTopic<ConnectionStatusChanged>(
  'connection-status-changed',
);
```

- A payload is plain JSON with ids only. The subscriber loads the rows it sends.
- `publish` is called from a background call that logs a failure, so no caller waits for Redis.
- `subscribe(topic, filter)` resolves once the subscription is live and delivers only the events that pass `filter`. Scoping to an owner happens in that filter, inside the service: `statusChanges(ownerId)`.
- Delivery is at most once, and the Redis channel is `onedoor:<topic>`. Each instance holds one Redis subscription per topic for all its subscribers.

### GraphQL subscriptions

`GraphqlApiModule` serves subscriptions over `graphql-ws` on `/graphql`. The context function puts the socket's upgrade request in `req`, so `CallerGuard` and `@CurrentCaller()` work as for queries.

```ts
@Subscription(() => ConnectionModel, {
  description: "Sends one of the caller's connections each time its status changes.",
  resolve(this: ConnectionsSubscription, event: ConnectionStatusChanged) {
    return this.connectionsService.getForOwner(event.ownerId, event.connectionId);
  },
})
connectionStatusChanged(@CurrentCaller() caller: Caller) {
  return this.registry.statusChanges(caller.userId);
}
```

- One class per feature in `<feature>.subscription.ts`. The method returns the service's iterator, and `resolve` loads the object with a service method.
- A field that is computed and not stored, such as `Connection.status`, is a `@ResolveField` in `<name>.resolver.ts`.
- Because `resolve` reads current state, a subscriber may see the same status twice or miss a short one in between. The last event it gets is current.
- `isAllowedSocketOrigin` in `server/src/auth/socket-origin.ts` checks every socket in `onConnect`. A socket with an `Origin` header is accepted only from `localhost`, `127.0.0.1` or `[::1]`, and a socket without one is accepted.

### Tests

- `RedisEventBus` has a unit test against Redis in Testcontainers. It checks Redis subscriptions with `PUBSUB NUMSUB`.
- A subscription e2e test starts Postgres and Redis, calls `app.listen(0, '127.0.0.1')`, and connects with `createClient` from `graphql-ws` and `WebSocket` from `ws`. Before it triggers an event, it waits until `PUBSUB NUMSUB onedoor:<topic>` shows the server's subscription, and it waits for the count to drop to 0 again before the next test subscribes.
- Assert the last status for an id, not the exact order of statuses.

## Web GraphQL client

Approved 2026-11-22.

### Operations and codegen

Operations live in `.graphql` files under `web/src/graphql/`, one file per feature. GraphQL Code Generator reads `../server/schema.gql` as a file and writes one committed file, `web/src/gql/graphql.ts`, with a typed document per operation:

```text
web/
├── codegen.ts                  schema, documents, plugins
└── src/
    ├── graphql/
    │   └── connections.graphql query Connections { ... }
    └── gql/
        └── graphql.ts          generated: ConnectionsQuery, ConnectionsDocument
```

- After changing an operation or pulling a new `schema.gql`, run `pnpm codegen` and commit `src/gql/graphql.ts`. Web `verify` runs `codegen` and then `check-codegen`, so it fails when the committed file differs.
- The plugins are `typescript-operations` and `typed-document-node`, with `enumsAsTypes`. The file holds types only for what the operations use. Do not add the client preset (its `gql.ts` uses `any`) or the `typescript` plugin (it declares the enums a second time).
- Never edit `src/gql/` by hand.

### Using a document

Pass the generated document to Apollo's hooks, with no type arguments. A query a screen reads goes through a hook in `src/hooks/` (see "Web routes, hooks and components"). `useQuery` alone renders the loading state on the server, so screens use `useSuspenseQuery` with the query preloaded in the route loader.

### Client and endpoint

- `src/router.tsx` creates a new `ApolloClient` per router, imported with `InMemoryCache` and `routerWithApolloClient` from `@apollo/client-integration-tanstack-start`, and wraps the router with `routerWithApolloClient`. The root route uses `createRootRouteWithContext<ApolloClientIntegration.RouterContext>()`.
- `graphqlEndpoint()` in `src/lib/graphql-endpoint.ts` is the GraphQL URL: `/graphql` in the browser, `${API_URL}/graphql` on the server.
- The browser talks only to the web server. Nitro `routeRules` in `vite.config.ts` forward `/graphql` and `/icons/**` to `API_URL` (default `http://127.0.0.1:3000`). Vite's `server.proxy` has no effect under Nitro.
- `API_URL` is listed in `web/.env.example`.

### Subscriptions

Approved 2026-11-22.

- In the browser, `createLink()` in `src/router.tsx` splits subscriptions onto one `GraphQLWsLink` (`createClient` from `graphql-ws`); queries and mutations stay on `HttpLink`. Server-side rendering uses `HttpLink` only and runs no subscriptions.
- Nitro forwards only HTTP, so the socket goes straight to the OneDoor server at `graphqlSocketUrl()`: `VITE_GRAPHQL_WS_URL`, read at build time, default `ws://127.0.0.1:3000/graphql`. This is the one exception to "the browser talks only to the web server". The server accepts sockets only from pages served from this machine.
- A subscription selects `id` and the changed fields, so Apollo updates the cached object by id and every view of it re-renders. Add each such field to every selection of that type (queries and mutation results), so the cache always has it.
- A subscription hook in `src/hooks/` calls `useSubscription(<Document>)` and returns nothing when the cache does the work. The route component calls it once per screen:

```ts
export function useConnectionStatusChanges(): void {
  useSubscription(ConnectionStatusChangedDocument)
}
```

- A component that shows a live value wraps it in `aria-live="polite"`, so screen readers announce the change.

## Web routes, hooks and components

Approved 2026-11-22.

### Files

```text
web/src/
├── routes/servers.tsx                  createFileRoute("/servers"): loader, head, component
├── hooks/use-connections.ts            useConnections()
├── components/servers/                 the screen's sections, one component per file
│   ├── catalog-section.tsx
│   └── my-servers-section.tsx
├── components/ui/                      shadcn components, added with the CLI
└── lib/auth-type.ts                    labels and small helpers shared by screens
```

- File names are kebab-case. A screen's components live in `src/components/<screen>/`.
- `/` redirects to `/servers` in `beforeLoad`.
- The route component renders the page frame (`<main>`, `<h1>`) and the sections. A section reads its data through hooks; the route passes no data down.
- Each route sets its title in `head`: `"<Screen> · OneDoor"`.
- Layout works at 375 px with no horizontal scroll: `p-4 sm:p-8` on the page, and rows that wrap.

### Query hooks

A hook wraps one query and returns the field the screen needs:

```ts
// src/hooks/use-connections.ts
export function useConnections() {
  return useSuspenseQuery(ConnectionsDocument).data.connections
}
```

The route loader preloads every query its sections read, so the requests start together and the server-rendered HTML holds the data:

```ts
export const Route = createFileRoute("/servers")({
  loader: ({ context: { preloadQuery } }) => {
    preloadQuery(CatalogDocument)
    preloadQuery(ConnectionsDocument)
  },
  head: () => ({ meta: [{ title: "Servers · OneDoor" }] }),
  component: ServersPage,
})
```

The loader does not return the query refs. The hooks read the results from the cache, so they take no arguments.

### Mutation hooks

A hook wraps one mutation and returns a named function with plain arguments, plus `loading`:

```ts
// src/hooks/use-set-connection-enabled.ts
export function useSetConnectionEnabled() {
  const [mutate, { loading }] = useMutation(SetConnectionEnabledDocument)
  const setEnabled = (id: string, enabled: boolean) =>
    mutate({ variables: { id, enabled } })
  return { setEnabled, loading }
}
```

- The mutation selects the changed object's `id` and the fields screens show, so Apollo updates the cached object by id.
- A mutation that creates an object, or changes which object a field points to, refetches the queries that show it, with `refetchQueries: [XDocument]` and `awaitRefetchQueries: true`. `useSwitchOnCatalogEntry` refetches `Catalog` and `Connections`.
- The function rejects on an error. The component catches it.

### Errors in the UI

`errorCode(error)` in `src/lib/graphql-error.ts` returns the server's `extensions.code`, or `undefined`. A component maps the codes it expects to its own message and has a generic message for the rest. It never shows the server's message text. The message appears next to the control, in an element with `role="alert"`.

### Dialogs

A dialog is a component in `src/components/<screen>/` built on shadcn `Dialog`, controlled by its parent through `open` and `onOpenChange`. It reports the user's choice through a callback, such as `onChoose(authType)`, and the parent runs the mutation.

### Forms

Forms use TanStack Form (`@tanstack/react-form`) with shadcn's `Field` components. `add-server-dialog.tsx` is the example.

- `useForm({ defaultValues, onSubmit })`. Default values are strings, so inputs stay controlled. Enum fields start at a real value, such as `"NONE" as AuthType`.
- Each field renders through `form.Field` inside `Field`, with `FieldLabel htmlFor={field.name}`, the control with `id={field.name}`, `aria-invalid`, and `FieldError` when the field is touched and invalid.
- Field validators (`validators: { onChange }`) return a message string or `undefined`. They check only what the user can fix at once, such as required fields and lengths. The server is the gate.
- Fields that depend on another field's value render inside `form.Subscribe`, so a hidden field is not validated. Groups of such fields are render functions inside the form component, not separate components.
- `onSubmit` maps the values to the GraphQL input, sending only the fields that apply, calls the mutation hook, and on success closes the dialog and resets the form. On an error it shows a message by `errorCode()` above the buttons.
- A field filled in from a server response (the probe) is filled again only while the user has not changed it.
- Secret inputs use `type="password"` and `autoComplete="off"`, and are never filled in from stored values.
- An edit form sends only the fields that changed. A stored secret shows "Set" or "Not set" above an empty input: empty keeps it (the field is left out), "Clear" sends `null`, and a typed value replaces it. `edit-server-dialog.tsx` is the example.
- A list row that has its own dialogs is its own component (`my-server-row.tsx`) and holds their open state.

### shadcn components

- Add components with `pnpm dlx shadcn@latest add <component> --yes`. They are committed in `src/components/ui/` and may be edited. When the CLI asks to overwrite an existing component, answer no (`printf 'n\n' | pnpm dlx shadcn@latest add ...`).
- An edit to a generated component carries a comment that says why. `ItemGroup` in `item.tsx` renders a `<ul>` for Biome's `useSemanticElements` rule, and items in it use `render={<li />}`.
- Icons from the server are rendered with `<img src={iconUrl} alt="">`, never inlined.

## Web end-to-end tests

Approved 2026-11-22.

### Running

`pnpm e2e` in `web` runs Playwright. It needs Docker and free ports 3100 and 3101, and it is not part of `pnpm verify`. A PR that changes a web screen reports both results.

### Setup

`web/e2e/global-setup.ts` starts everything once and returns the teardown:

- Postgres and Redis containers from the Compose images, and the fake upstream servers in `web/e2e/twins/`.
- The server, run from `../server` as processes: `prisma migrate deploy`, `prisma db seed`, `tsc -p tsconfig.build.json --outDir .e2e-build`, then `node .e2e-build/main.js` on port 3100 with `ICON_FETCHING=false` and a random `SECRET_STORE_KEY`. web never imports server code.
- The server runs with `UPSTREAM_CONNECTING=true`. Only NONE connections connect, and no seeded catalog entry is NONE, so clients reach only the twins.
- The web app, built with `API_URL` and `VITE_GRAPHQL_WS_URL` set to the server and run from `.output` on port 3101.
- Process output goes to `web/test-results/api.log` and `web.log`.

Values the flows need, such as a twin's URL, go through `process.env` (`E2E_TWIN_URL`).

### Flows

- Flows are `web/e2e/<screen>.e2e.ts`. The name keeps Vitest from running them.
- Test titles name the requirements they cover.
- Flows share one database and run one at a time, in file order. A flow does not depend on another flow's data, except that the first flow on a screen may assert its empty state.
- Find elements by role and accessible name (`getByRole("switch", { name: "Use GitHub" })`) or by label, not by CSS classes.
- A twin in `web/e2e/twins/` is a small fake MCP server on 127.0.0.1 with a free port. Twins do not reach the network.
- After adding a flow, break the behaviour it covers once and see it fail.
- To show that a value is live, change the data from outside the page with `request.post("/graphql", ...)` and assert the page updates without a reload.

