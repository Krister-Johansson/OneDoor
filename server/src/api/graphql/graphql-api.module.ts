import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import type { Context } from 'graphql-ws';
import type { Extra } from 'graphql-ws/use/ws';
import { isAllowedSocketOrigin } from '../../auth/socket-origin.js';
import { UpstreamsModule } from '../../services/upstreams/upstreams.module.js';
import { CatalogMutation } from './catalog/catalog.mutation.js';
import { CatalogQuery } from './catalog/catalog.query.js';
import { ConnectionResolver } from './connections/connection.resolver.js';
import { ConnectionsMutation } from './connections/connections.mutation.js';
import { ConnectionsQuery } from './connections/connections.query.js';
import { ConnectionsSubscription } from './connections/connections.subscription.js';
import { ProbeMutation } from './probe/probe.mutation.js';
import { ToolsMutation } from './tools/tools.mutation.js';
import { ViewerQuery } from './viewer/viewer.query.js';

// The GraphQL API for the web UI, code-first. The schema is built in memory;
// test/schema.e2e-spec.ts keeps server/schema.gql in step with it.
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      // Subscriptions over graphql-ws on the same /graphql path. Returning
      // false refuses the socket with 4403 Forbidden.
      subscriptions: {
        'graphql-ws': {
          // Nest serves graphql-ws with its ws adapter, so `extra` is its Extra.
          onConnect: (context: Context<Record<string, unknown> | undefined>) =>
            isAllowedSocketOrigin(
              (context.extra as Extra).request.headers.origin,
            ),
        },
      },
      // A function, so each request gets its own context with its own caller.
      // Over graphql-ws there is no request per operation; the caller goes
      // on the upgrade request of the socket.
      context: ({
        req,
        extra,
      }: {
        req?: unknown;
        extra?: { request: unknown };
      }) => ({ req: req ?? extra?.request }),
      // Stack traces never reach clients; DomainErrorFilter logs them.
      includeStacktraceInErrorResponses: false,
    }),
    UpstreamsModule,
  ],
  providers: [
    ConnectionsQuery,
    ConnectionsMutation,
    CatalogQuery,
    CatalogMutation,
    ConnectionResolver,
    ConnectionsSubscription,
    ToolsMutation,
    ProbeMutation,
    ViewerQuery,
  ],
})
export class GraphqlApiModule {}
