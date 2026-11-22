import { HttpLink } from "@apollo/client"
import {
  ApolloClient,
  InMemoryCache,
  routerWithApolloClient,
} from "@apollo/client-integration-tanstack-start"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { graphqlEndpoint } from "#/lib/graphql-endpoint"
import { routeTree } from "./routeTree.gen"

// Runs on the server and in the browser, so a new Apollo Client per router.
export function getRouter() {
  const apolloClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: new HttpLink({ uri: graphqlEndpoint() }),
  })

  const router = createTanStackRouter({
    routeTree,
    context: { ...routerWithApolloClient.defaultContext },
    scrollRestoration: true,
    defaultPreload: "intent",
    defaultPreloadStaleTime: 0,
  })

  return routerWithApolloClient(router, apolloClient)
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
