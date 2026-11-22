import { Field, ID, ObjectType } from '@nestjs/graphql';
import { AuthType } from '../generated/prisma/enums.js';
import { ConnectionModel } from './connection.model.js';

@ObjectType('CatalogAuthOption', {
  description:
    'One way to connect to a catalog entry: an auth type with its URL (REQ-CONN-010).',
})
export class CatalogAuthOptionModel {
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

@ObjectType('CatalogEntry', {
  description: 'A pre-installed server that the caller can switch on.',
})
export class CatalogEntryModel {
  @Field(() => ID)
  id: string;

  @Field({ description: 'A stable identifier, such as github.' })
  key: string;

  @Field()
  displayName: string;

  @Field()
  description: string;

  @Field({ description: "The icon's URL path on this server (REQ-CONN-070)." })
  iconUrl: string;

  @Field(() => [CatalogAuthOptionModel], {
    description: 'In the order of the AuthType enum.',
  })
  authOptions: CatalogAuthOptionModel[];

  @Field(() => ConnectionModel, {
    nullable: true,
    description:
      "The caller's connection for this entry, if any (REQ-CONN-011).",
  })
  connection: ConnectionModel | null;
}
