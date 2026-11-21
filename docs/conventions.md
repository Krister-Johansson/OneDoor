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
