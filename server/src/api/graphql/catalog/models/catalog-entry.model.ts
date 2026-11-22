import { Field, ID, ObjectType } from '@nestjs/graphql';
import { ConnectionModel } from '../../connections/models/connection.model.js';
import { CatalogAuthOptionModel } from './catalog-auth-option.model.js';

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
