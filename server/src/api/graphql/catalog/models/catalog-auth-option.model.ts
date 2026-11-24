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

  @Field(() => String, {
    nullable: true,
    description:
      'Only for OAUTH_MANUAL: the client id of the OAuth app that every connection on this option uses. Null until it is set; the option cannot be switched on before (T22).',
  })
  oauthClientId: string | null;

  @Field({
    description:
      "Whether the OAuth app's client secret is stored. The secret is never returned.",
  })
  hasClientSecret: boolean;

  @Field(() => [String], {
    description:
      'The placeholders in the URL, such as organization. Switching on the option takes a value for each (T22).',
  })
  urlParameters: string[];
}
