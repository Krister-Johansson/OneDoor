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
