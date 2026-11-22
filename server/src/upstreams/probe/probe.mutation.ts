import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { CheckCredentialsInput } from './inputs/check-credentials.input.js';
import {
  CredentialsCheckModel,
  ProbeResultModel,
} from './models/probe-result.model.js';
import { ProbeService } from './probe.service.js';

// Mutations, not queries, because they send requests to other hosts.
@Resolver()
export class ProbeResolver {
  constructor(private readonly probeService: ProbeService) {}

  @Mutation(() => ProbeResultModel, {
    description:
      'Checks a server URL without credentials. Stores nothing (REQ-CONN-060).',
  })
  probeServer(@Args('url') url: string): Promise<ProbeResultModel> {
    return this.probeService.probe(url);
  }

  @Mutation(() => CredentialsCheckModel, {
    description:
      'Connects with credentials and lists the tools. Stores nothing (REQ-CONN-062).',
  })
  checkCredentials(
    @Args('input') input: CheckCredentialsInput,
  ): Promise<CredentialsCheckModel> {
    return this.probeService.checkCredentials(input);
  }
}
