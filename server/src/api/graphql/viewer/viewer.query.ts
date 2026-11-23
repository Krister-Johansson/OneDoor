import { Query, Resolver } from '@nestjs/graphql';
import type { Caller } from '../../../auth/caller.js';
import { CurrentCaller } from '../../../auth/current-caller.decorator.js';
import { ViewerModel } from './models/viewer.model.js';

@Resolver(() => ViewerModel)
export class ViewerQuery {
  @Query(() => ViewerModel, {
    description: 'The user the request acts for, for the web sidebar.',
  })
  viewer(@CurrentCaller() caller: Caller): ViewerModel {
    return ViewerModel.from(caller);
  }
}
