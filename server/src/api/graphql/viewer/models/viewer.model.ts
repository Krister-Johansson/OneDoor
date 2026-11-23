import { Field, ID, ObjectType } from '@nestjs/graphql';
import type { Caller } from '../../../../auth/caller.js';

@ObjectType('Viewer', {
  description:
    'The user the request acts for. Until sign-in exists, always the seeded user `me`.',
})
export class ViewerModel {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  static from(caller: Caller): ViewerModel {
    return { id: caller.userId, name: caller.userName };
  }
}
