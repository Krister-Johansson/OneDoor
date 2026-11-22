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
