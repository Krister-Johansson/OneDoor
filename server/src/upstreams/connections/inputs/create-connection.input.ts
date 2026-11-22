import { Field, InputType } from '@nestjs/graphql';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { AuthType } from '../../../generated/prisma/enums.js';
import {
  HasNoControlCharacters,
  IsHeaderName,
  IsServerUrl,
} from '../connection-rules.js';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

// Validates a field that may be left out but not set to null.
const IfGiven = () => ValidateIf((_object, value) => value !== undefined);

@InputType({ description: 'A custom server to add (REQ-CONN-020).' })
export class CreateConnectionInput {
  @Field({
    description: '1 to 60 characters, unique per user ignoring case.',
  })
  @Transform(trim)
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

@InputType({
  description:
    'Changes to a custom server. A field left out keeps its value. Changing the url or authType deletes the stored credentials unless the same input sets new ones (REQ-CONN-023).',
})
export class UpdateConnectionInput {
  @Field(() => String, { nullable: true })
  @IfGiven()
  @Transform(trim)
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
