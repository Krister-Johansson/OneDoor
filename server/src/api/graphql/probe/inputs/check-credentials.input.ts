import { Field, InputType } from '@nestjs/graphql';
import { IsIn, IsOptional, IsString, Length, MaxLength } from 'class-validator';
import { AuthType } from '../../../../generated/prisma/enums.js';
import type { CheckCredentialsData } from '../../../../services/upstreams/probe/probe.interface.js';
import {
  HasNoControlCharacters,
  IsHeaderName,
  IsServerUrl,
} from '../../../validation/validators.js';

@InputType({
  description:
    'Credentials to check before saving (REQ-CONN-062). Nothing is stored.',
})
export class CheckCredentialsInput implements CheckCredentialsData {
  @Field()
  @IsServerUrl()
  url: string;

  @Field(() => AuthType, { description: 'NONE or API_KEY.' })
  @IsIn([AuthType.NONE, AuthType.API_KEY], {
    message:
      'authType must be NONE or API_KEY; OAuth is checked after authorization',
  })
  authType: AuthType;

  @Field(() => String, { nullable: true, description: 'Required for API_KEY.' })
  @IsOptional()
  @IsString()
  @Length(1, 4096)
  @HasNoControlCharacters()
  apiKey?: string | null;

  @Field(() => String, {
    nullable: true,
    description: 'Defaults to Authorization.',
  })
  @IsOptional()
  @IsHeaderName()
  headerName?: string | null;

  @Field(() => String, { nullable: true, description: 'Defaults to Bearer.' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  @HasNoControlCharacters()
  headerPrefix?: string | null;
}
