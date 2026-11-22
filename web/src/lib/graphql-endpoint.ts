import { createIsomorphicFn } from "@tanstack/react-start"

// Where Apollo sends GraphQL requests. The browser uses the same origin:
// the Vite dev server (and later the proxy) forwards /graphql and /icons to
// the OneDoor server. Rendering on the server calls it directly, at API_URL.
export const graphqlEndpoint = createIsomorphicFn()
  .server(() => `${process.env.API_URL ?? "http://127.0.0.1:3000"}/graphql`)
  .client(() => "/graphql")
