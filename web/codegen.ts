import type { CodegenConfig } from "@graphql-codegen/cli"

// Typed documents from the operations in src/**/*.graphql, checked against
// the server's committed schema. The schema file is the only thing web reads
// from server. Run `pnpm codegen` after changing an operation or the schema,
// and commit src/gql/graphql.ts.
const config: CodegenConfig = {
  schema: "../server/schema.gql",
  documents: ["src/**/*.graphql"],
  generates: {
    // One file: a type per operation, the enums and inputs they use, and a typed
    // document per operation, such as ConnectionsDocument.
    "src/gql/graphql.ts": {
      plugins: ["typescript-operations", "typed-document-node"],
      config: {
        enumsAsTypes: true,
        useTypeImports: true,
        // Apollo Client adds __typename to every object it requests.
        nonOptionalTypename: true,
        skipTypeNameForRoot: true,
        scalars: { DateTime: "string" },
      },
    },
  },
  hooks: { afterAllFileWrite: ["biome check --write"] },
}

export default config
