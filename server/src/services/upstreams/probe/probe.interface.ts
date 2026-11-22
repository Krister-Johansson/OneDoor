import type { AuthType } from '../../../generated/prisma/enums.js';

export const ProbeStatus = {
  MCP_SERVER: 'MCP_SERVER',
  AUTH_REQUIRED: 'AUTH_REQUIRED',
  NOT_MCP: 'NOT_MCP',
  UNREACHABLE: 'UNREACHABLE',
  REFUSED: 'REFUSED',
} as const;
export type ProbeStatus = (typeof ProbeStatus)[keyof typeof ProbeStatus];

export const CredentialsStatus = {
  OK: 'OK',
  REFUSED_CREDENTIALS: 'REFUSED_CREDENTIALS',
  NOT_MCP: 'NOT_MCP',
  UNREACHABLE: 'UNREACHABLE',
  REFUSED: 'REFUSED',
} as const;
export type CredentialsStatus =
  (typeof CredentialsStatus)[keyof typeof CredentialsStatus];

// What a server shows without credentials (REQ-CONN-060).
export interface ProbeResult {
  status: ProbeStatus;
  message: string;
  authRequired: boolean;
  oauth: boolean;
  oauthDcr: boolean;
  suggestedAuthType: AuthType | null;
  serverName: string | null;
  serverTitle: string | null;
  serverVersion: string | null;
  serverDescription: string | null;
  iconUrls: string[];
}

// Credentials to check before saving (REQ-CONN-062).
export interface CheckCredentialsData {
  url: string;
  authType: AuthType;
  apiKey?: string | null;
  headerName?: string | null;
  headerPrefix?: string | null;
}

// The result of connecting with credentials (REQ-CONN-062).
export interface CredentialsCheck {
  status: CredentialsStatus;
  message: string;
  toolCount: number | null;
  toolNames: string[];
}
