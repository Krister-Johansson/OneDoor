import type { SecretStore } from '../../../crypto/secret-store.js';
import { InternalError } from '../../../errors/domain-errors.js';
import { AuthType } from '../../../generated/prisma/enums.js';
import {
  apiKeyHeaderValue,
  DEFAULT_HEADER_NAME,
  DEFAULT_HEADER_PREFIX,
} from '../connections/connection-rules.js';
import type {
  UpstreamAuth,
  UpstreamAuthTarget,
} from './upstream-auth.interface.js';
import { UpstreamAuthProvider } from './upstream-auth-provider.js';

// API_KEY: the stored key, decrypted, in one header (REQ-CONN-040). The
// header is sensitive, so a redirect to another origin drops it.
export class ApiKeyAuthProvider extends UpstreamAuthProvider {
  readonly authType = AuthType.API_KEY;

  constructor(private readonly secretStore: SecretStore) {
    super();
  }

  fingerprint(target: UpstreamAuthTarget): string {
    const { name, prefix } = headerSettings(target);
    return JSON.stringify([
      name,
      prefix,
      target.apiKey?.keyId ?? null,
      target.apiKey?.ciphertext ?? null,
    ]);
  }

  async authenticate(target: UpstreamAuthTarget): Promise<UpstreamAuth> {
    if (!target.apiKey) {
      throw new InternalError({
        cause: new Error(
          `Connection ${target.connectionId} has no stored API key`,
        ),
      });
    }
    const key = await this.secretStore.decrypt(
      target.apiKey,
      `connection:${target.connectionId}:api_key`,
    );
    const { name, prefix } = headerSettings(target);
    return {
      headers: { [name]: apiKeyHeaderValue(prefix, key) },
      sensitiveHeaders: [name],
    };
  }
}

function headerSettings(target: UpstreamAuthTarget) {
  return {
    name: target.headerName ?? DEFAULT_HEADER_NAME,
    prefix: target.headerPrefix ?? DEFAULT_HEADER_PREFIX,
  };
}
