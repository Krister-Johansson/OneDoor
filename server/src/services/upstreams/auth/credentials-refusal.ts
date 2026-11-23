import { SdkHttpError, UnauthorizedError } from '@modelcontextprotocol/client';

// Whether a failed connect or request means the server refused the
// credentials: 401 or 403, or an OAuth challenge the client cannot answer.
export function isCredentialsRefusal(error: unknown): boolean {
  return (
    error instanceof UnauthorizedError ||
    (error instanceof SdkHttpError &&
      (error.status === 401 || error.status === 403))
  );
}
