import { Field, InputType } from '@nestjs/graphql';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { AuthType } from '../../../generated/prisma/enums.js';
import {
  HasNoControlCharacters,
  IsHeaderName,
  IsServerUrl,
  Trim,
} from '../connection-rules.js';

@InputType({ description: 'A custom server to add (REQ-CONN-020).' })
export class CreateConnectionInput {
  @Field({
    description: '1 to 60 characters, unique per user ignoring case.',
  })
  @Trim()
  @IsString()
  @Length(1, 60)
  @HasNoControlCharacters()
  displayName: string;

  @Field(() => String, { nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  description?: string | null;

  @Field({
    description: 'https, or http only for localhost and 127.0.0.1.',
  })
  @IsServerUrl()
  url: string;

  @Field(() => AuthType)
  @IsEnum(AuthType)
  authType: AuthType;

  @Field(() => String, {
    nullable: true,
    description: 'Required for API_KEY, and only for it. Write-only.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  @HasNoControlCharacters()
  apiKey?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Only for API_KEY. Defaults to Authorization.',
  })
  @IsOptional()
  @IsHeaderName()
  headerName?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Only for API_KEY. Defaults to Bearer. May be empty.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @HasNoControlCharacters()
  headerPrefix?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Required for OAUTH_MANUAL, and only for it.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 256)
  @HasNoControlCharacters()
  oauthClientId?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Required for OAUTH_MANUAL, and only for it. Write-only.',
  })
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  @HasNoControlCharacters()
  oauthClientSecret?: string | null;
}
