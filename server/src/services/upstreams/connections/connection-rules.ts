import { fetchUrlProblem } from '../../../net/url-policy.js';

// Field rules for connections (specs/connections.md). The functions return
// the problem as text, or null when the value is fine. Messages never repeat
// the value, because some fields hold secrets.

export const DEFAULT_HEADER_NAME = 'Authorization';
export const DEFAULT_HEADER_PREFIX = 'Bearer';

// REQ-CONN-022: the same rule the guarded fetch applies.
export const serverUrlProblem = fetchUrlProblem;

// An HTTP field name (RFC 9110 token) of 1 to 100 characters.
const HEADER_NAME_PATTERN = /^[!#$%&'*+.^_`|~0-9A-Za-z-]{1,100}$/;

// REQ-CONN-043: headers the MCP transport sets itself.
const RESERVED_HEADER_NAMES = new Set([
  'host',
  'content-length',
  'content-type',
  'transfer-encoding',
  'connection',
  'mcp-session-id',
  'mcp-protocol-version',
]);

export function headerNameProblem(value: string): string | null {
  if (!HEADER_NAME_PATTERN.test(value)) {
    return 'headerName must be an HTTP header name of 1 to 100 characters';
  }
  if (RESERVED_HEADER_NAMES.has(value.toLowerCase())) {
    return 'headerName must not be a header that the MCP transport sets';
  }
  return null;
}

// Control characters such as CR and LF would let a value end a header line.
export function hasControlCharacter(value: string): boolean {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}
