import { createHash } from 'node:crypto';
import type { UpstreamTool } from './tool.interface.js';

// The content hash of a tool: SHA-256 of the canonical JSON of the fields a
// sync stores. Key order and absent optional fields do not change it, so
// only a real change to the tool rewrites its row.
export function toolContentHash(tool: UpstreamTool): string {
  const content = {
    name: tool.name,
    title: tool.title ?? null,
    description: tool.description ?? '',
    inputSchema: tool.inputSchema,
    outputSchema: tool.outputSchema ?? null,
    annotations: tool.annotations ?? null,
  };
  return createHash('sha256').update(canonicalJson(content)).digest('hex');
}

// JSON with object keys sorted at every level.
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value)
        .sort()
        .map((key) => [key, sortKeys((value as Record<string, unknown>)[key])]),
    );
  }
  return value;
}
