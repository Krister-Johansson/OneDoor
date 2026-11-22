import { Field, ObjectType } from '@nestjs/graphql';
import { AuthType } from '../../../../generated/prisma/enums.js';
import type { CatalogAuthOption } from '../../../../services/upstreams/catalog/catalog-entry.interface.js';

@ObjectType('CatalogAuthOption', {
  description:
    'One way to connect to a catalog entry: an auth type with its URL (REQ-CONN-010).',
})
export class CatalogAuthOptionModel implements CatalogAuthOption {
  @Field(() => AuthType)
  authType: AuthType;

  @Field()
  url: string;

  @Field(() => String, { nullable: true, description: 'Only for API_KEY.' })
  headerName: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Only for API_KEY. May be empty.',
  })
  headerPrefix: string | null;
}
