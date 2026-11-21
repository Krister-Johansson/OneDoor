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

Plain HTTP routes are few: health checks, the OAuth callback and icons. GraphQL serves everything else. Generate the module and controller with the Nest CLI, and a helper provider with `nest g provider <module>/<name> --flat --no-spec`:

```bash
pnpm exec nest g module health
pnpm exec nest g controller health
pnpm exec nest g provider health/redis.health --flat --no-spec
```

A controller has one `@Controller('<area>')` prefix and methods that only delegate. Delete the controller spec that `nest g controller` writes; an e2e test covers the routes.

### Health checks

`HealthModule` uses `@nestjs/terminus`:

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

It handles only HTTP. The GraphQL mapping to `extensions.code` comes with the GraphQL API. MCP tool errors do not use the filter; they are returned as results with `isError: true`.

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

### Seed

`prisma/seed.ts` creates the rows every environment needs, with `upsert` so it can run any number of times. It exports `seed(prisma)` for tests and runs itself only under `import.meta.main`. Run it with `pnpm prisma db seed`.

### Database tests against the migrations

A test that needs the real schema starts its database with `startMigratedPostgres()` from `server/test/support/database.ts`, which runs `prisma migrate deploy` on a Testcontainers Postgres. Call `seed(prisma)` when the test needs the seeded rows.

Assert a rejected check constraint by its name, and a Prisma error by the domain error `toDomainError` makes of it:

```ts
await expect(create()).rejects.toThrow(/connection_catalog_or_custom_check/);
expect(toDomainError(error, 'Connection')).toBeInstanceOf(ConflictError);
```
