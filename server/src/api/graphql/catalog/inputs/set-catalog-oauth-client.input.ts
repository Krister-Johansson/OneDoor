import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, Length } from 'class-validator';
import type { SetCatalogOAuthClientData } from '../../../../services/upstreams/catalog/catalog-entry.interface.js';
import {
  HasNoControlCharacters,
  Trim,
} from '../../../validation/validators.js';

@InputType({
  description:
    "The OAuth app of a catalog entry's OAUTH_MANUAL option. Every connection on the option uses it (T22).",
})
export class SetCatalogOAuthClientInput implements SetCatalogOAuthClientData {
  @Field()
  @Trim()
  @IsString()
  @Length(1, 256)
  @HasNoControlCharacters()
  clientId: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Left out keeps the stored secret, null deletes it, a string replaces it. A public client has none.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  @HasNoControlCharacters()
  clientSecret?: string | null;
}
