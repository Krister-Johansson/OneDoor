import { ApolloDriver, type ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { UpstreamsModule } from '../../services/upstreams/upstreams.module.js';
import { CatalogMutation } from './catalog/catalog.mutation.js';
import { CatalogQuery } from './catalog/catalog.query.js';
import { ConnectionsMutation } from './connections/connections.mutation.js';
import { ConnectionsQuery } from './connections/connections.query.js';
import { ProbeMutation } from './probe/probe.mutation.js';

// The GraphQL API for the web UI, code-first. The schema is built in memory;
// test/schema.e2e-spec.ts keeps server/schema.gql in step with it.
@Module({
  imports: [
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: true,
      sortSchema: true,
      // A function, so each request gets its own context with its own caller.
      context: ({ req }: { req: unknown }) => ({ req }),
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
    ProbeMutation,
  ],
})
export class GraphqlApiModule {}
