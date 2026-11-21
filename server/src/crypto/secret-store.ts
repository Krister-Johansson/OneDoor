// An encrypted secret as it is stored: the ciphertext and the id of the key
// that encrypted it. Neither is secret on its own.
export interface EncryptedSecret {
  ciphertext: string;
  keyId: string;
}

// Encrypts and decrypts secrets (API keys, client secrets, OAuth tokens)
// before they reach Prisma. Feature code injects this abstract class; the
// implementation is chosen by SECRET_STORE in CryptoModule.
//
// `context` binds a ciphertext to where it is stored, for example
// `connection:<id>:api_key`. Decrypting with another context fails, so a
// ciphertext copied to another row or field cannot be read there.
export abstract class SecretStore {
  // Identifies the implementation, for logs.
  abstract readonly id: string;

  abstract encrypt(
    plaintext: string,
    context: string,
  ): Promise<EncryptedSecret>;

  // Throws InternalError when the key id is unknown, or when the ciphertext,
  // key or context does not match. The error never contains the plaintext.
  abstract decrypt(secret: EncryptedSecret, context: string): Promise<string>;
}
