import type { Tool as ToolRecord } from '../../../generated/prisma/client.js';
import type { Tool, ToolAnnotations } from './tool.interface.js';

const HINTS = [
  'readOnlyHint',
  'destructiveHint',
  'idempotentHint',
  'openWorldHint',
] as const;

// Keeps only the boolean hints of the stored annotations. The server sent
// them, so anything else in them is dropped.
export function toToolAnnotations(stored: unknown): ToolAnnotations {
  const source =
    typeof stored === 'object' && stored !== null && !Array.isArray(stored)
      ? (stored as Record<string, unknown>)
      : {};
  const annotations: ToolAnnotations = {
    readOnlyHint: null,
    destructiveHint: null,
    idempotentHint: null,
    openWorldHint: null,
  };
  for (const hint of HINTS) {
    const value = source[hint];
    if (typeof value === 'boolean') annotations[hint] = value;
  }
  return annotations;
}

export function toTool(row: ToolRecord): Tool {
  return {
    id: row.id,
    connectionId: row.connectionId,
    name: row.name,
    title: row.title,
    description: row.description,
    annotations: toToolAnnotations(row.annotations),
    enabled: row.enabled,
  };
}
