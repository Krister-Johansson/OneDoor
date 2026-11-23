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
  const apolloClient: ApolloClient = new ApolloClient({
    cache: new InMemoryCache(),
    // An event published while the socket was closed is not replayed: on
    // the first page load, or while the API restarted. So every time the
    // socket opens, the queries on screen fetch again.
    link: createLink(() => {
      void apolloClient.refetchQueries({ include: "active" })
    }),
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
// one graphql-ws socket, opened on the first subscription; `onConnected`
// runs each time it opens. Server-side rendering runs no subscriptions.
const createLink = createIsomorphicFn()
  .server(
    (_onConnected: () => void): ApolloLink =>
      new HttpLink({ uri: graphqlEndpoint() }),
  )
  .client(
    (onConnected: () => void): ApolloLink =>
      ApolloLink.split(
        ({ operationType }) => operationType === OperationTypeNode.SUBSCRIPTION,
        new GraphQLWsLink(
          createClient({
            url: graphqlSocketUrl(),
            on: { connected: onConnected },
          }),
        ),
        new HttpLink({ uri: graphqlEndpoint() }),
      ),
  )

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
