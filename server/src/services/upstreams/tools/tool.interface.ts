import { defineTopic } from '../../../events/event-bus.js';

// A tool as an upstream server lists it (MCP `tools/list`). Everything in it
// is untrusted input from that server.
export interface UpstreamTool {
  name: string;
  title?: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  annotations?: Record<string, unknown>;
}

// What one sync changed.
export interface ToolSyncResult {
  added: number;
  changed: number;
  removed: number;
  unchanged: number;
}

// Published on the EventBus after each sync that stored a connection's
// tools, whether or not anything changed. It carries ids only; subscribers
// load the connection.
export interface ConnectionToolsSynced {
  connectionId: string;
  ownerId: string;
}

export const CONNECTION_TOOLS_SYNCED = defineTopic<ConnectionToolsSynced>(
  'connection-tools-synced',
);

// The MCP tool annotation hints, read from the stored annotations. Each is
// null when the server did not send it as a boolean. They are hints from an
// untrusted server: shown as labels, never enforced.
export interface ToolAnnotations {
  readOnlyHint: boolean | null;
  destructiveHint: boolean | null;
  idempotentHint: boolean | null;
  openWorldHint: boolean | null;
}

// A stored tool as the owner sees it (T19).
export interface Tool {
  id: string;
  connectionId: string;
  name: string;
  title: string | null;
  description: string;
  annotations: ToolAnnotations;
  enabled: boolean;
}
