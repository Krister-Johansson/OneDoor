import { createRequire } from 'node:module';
import type { INestApplication } from '@nestjs/common';
import { GraphQLSchemaHost } from '@nestjs/graphql';
import { Test } from '@nestjs/testing';
import { stubAppEnv } from './support/env.js';

// Load graphql the way Nest and Apollo load it. Vitest would otherwise give
// this file graphql's ESM build, a second copy that cannot read their schema.
const { printSchema } = createRequire(import.meta.url)(
  'graphql',
) as typeof import('graphql');

// The schema drift check. It builds the schema from the real AppModule and
// compares it with the committed server/schema.gql. After a schema change,
// run `pnpm generate-schema` and commit the file.
describe('GraphQL schema (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    // No database or Redis is needed. The values only pass config validation.
    stubAppEnv();

    const { AppModule } = await import('../src/app.module.js');
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
  });

  it('matches server/schema.gql', async () => {
    const { schema } = app.get(GraphQLSchemaHost);
    await expect(`${printSchema(schema)}\n`).toMatchFileSnapshot(
      '../schema.gql',
    );
  });
});
