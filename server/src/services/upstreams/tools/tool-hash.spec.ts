import { canonicalJson, toolContentHash } from './tool-hash.js';

const TOOL = {
  name: 'echo',
  description: 'Echoes the text.',
  inputSchema: {
    type: 'object',
    properties: { text: { type: 'string' } },
    required: ['text'],
  },
};

describe('toolContentHash', () => {
  it('is the same for the same tool with keys in another order', () => {
    const reordered = {
      inputSchema: {
        required: ['text'],
        properties: { text: { type: 'string' } },
        type: 'object',
      },
      description: 'Echoes the text.',
      name: 'echo',
    };
    expect(toolContentHash(reordered)).toBe(toolContentHash(TOOL));
  });

  it('treats an absent optional field like its default', () => {
    expect(
      toolContentHash({ ...TOOL, title: undefined, annotations: undefined }),
    ).toBe(toolContentHash(TOOL));
  });

  it.each([
    ['the description', { description: 'Echoes it back.' }],
    ['the title', { title: 'Echo' }],
    [
      'the input schema',
      { inputSchema: { ...TOOL.inputSchema, required: [] } },
    ],
    ['the output schema', { outputSchema: { type: 'object' } }],
    ['the annotations', { annotations: { readOnlyHint: true } }],
  ])('changes when %s changes', (_field, change) => {
    expect(toolContentHash({ ...TOOL, ...change })).not.toBe(
      toolContentHash(TOOL),
    );
  });

  it('is a SHA-256 hex digest', () => {
    expect(toolContentHash(TOOL)).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('canonicalJson', () => {
  it('sorts keys at every level and keeps array order', () => {
    expect(canonicalJson({ b: [{ d: 1, c: 2 }, 3], a: null })).toBe(
      '{"a":null,"b":[{"c":2,"d":1},3]}',
    );
  });
});
