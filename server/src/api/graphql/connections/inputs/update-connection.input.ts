import { Field, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { AuthType } from '../../../../generated/prisma/enums.js';
import type { UpdateConnectionData } from '../../../../services/upstreams/connections/connection.interface.js';
import {
  HasNoControlCharacters,
  IfGiven,
  IsHeaderName,
  IsServerUrl,
  Trim,
} from '../../../validation/validators.js';

@InputType({
  description:
    'Changes to a custom server. A field left out keeps its value. Changing the url or authType deletes the stored credentials unless the same input sets new ones (REQ-CONN-023).',
})
export class UpdateConnectionInput implements UpdateConnectionData {
  @Field(() => String, { nullable: true })
  @IfGiven()
  @Trim()
  @IsString()
  @Length(1, 60)
  @HasNoControlCharacters()
  displayName?: string;

  @Field(() => String, {
    nullable: true,
    description: 'null clears the description.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @Field(() => String, { nullable: true })
  @IfGiven()
  @IsServerUrl()
  url?: string;

  @Field(() => AuthType, { nullable: true })
  @IfGiven()
  @IsEnum(AuthType)
  authType?: AuthType;

  @Field(() => String, {
    nullable: true,
    description:
      'Left out keeps the stored key, null deletes it, a string replaces it.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  @HasNoControlCharacters()
  apiKey?: string | null;

  @Field(() => String, { nullable: true })
  @IfGiven()
  @IsHeaderName()
  headerName?: string;

  @Field(() => String, { nullable: true })
  @IfGiven()
  @IsString()
  @MaxLength(50)
  @HasNoControlCharacters()
  headerPrefix?: string;

  @Field(() => String, { nullable: true })
  @IfGiven()
  @IsString()
  @Length(1, 256)
  @HasNoControlCharacters()
  oauthClientId?: string;

  @Field(() => String, {
    nullable: true,
    description:
      'Left out keeps the stored secret, null deletes it, a string replaces it.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  @HasNoControlCharacters()
  oauthClientSecret?: string | null;
}
