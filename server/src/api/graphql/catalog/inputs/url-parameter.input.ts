import { Field, InputType } from '@nestjs/graphql';
import { IsString, Length } from 'class-validator';
import type { UrlParameter } from '../../../../services/upstreams/catalog/catalog-entry.interface.js';

@InputType({
  description:
    "A value for a placeholder in a catalog auth option's URL, such as the organization of Azure DevOps (T22).",
})
export class UrlParameterInput implements UrlParameter {
  @Field({ description: 'The placeholder name, such as organization.' })
  @IsString()
  @Length(1, 50)
  name: string;

  @Field({
    description:
      'One URL path segment: letters, digits, dots, underscores and hyphens.',
  })
  @IsString()
  @Length(1, 100)
  value: string;
}
