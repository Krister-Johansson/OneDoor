import { ApolloLink, HttpLink } from "@apollo/client"
import { GraphQLWsLink } from "@apollo/client/link/subscriptions"
import {
  ApolloClient,
  InMemoryCache,
  routerWithApolloClient,
} from "@apollo/client-integration-tanstack-start"
import { createRouter as createTanStackRouter } from "@tanstack/react-router"
import { createIsomorphicFn } from "@tanstack/react-start"
import { OperationTypeNode } from "graphql"
import { createClient } from "graphql-ws"
import { graphqlEndpoint, graphqlSocketUrl } from "#/lib/graphql-endpoint"
import { routeTree } from "./routeTree.gen"

// Runs on the server and in the browser, so a new Apollo Client per router.
export function getRouter() {
  const apolloClient = new ApolloClient({
    cache: new InMemoryCache(),
    link: createLink(),
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

// Queries and mutations go over HTTP. In the browser, subscriptions go over
// one graphql-ws socket, opened on the first subscription. Server-side
// rendering runs no subscriptions.
const createLink = createIsomorphicFn()
  .server((): ApolloLink => new HttpLink({ uri: graphqlEndpoint() }))
  .client(
    (): ApolloLink =>
      ApolloLink.split(
        ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
        new GraphQLWsLink(createClient({ url: graphqlSocketUrl() })),
        new HttpLink({ uri: graphqlEndpoint() }),
      ),
  )

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
