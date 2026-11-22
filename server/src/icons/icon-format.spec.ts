import { detectIconType, MAX_ICON_BYTES } from './icon-format.js';

const bytes = (...values: number[]) => new Uint8Array(values);
const text = (value: string) => new TextEncoder().encode(value);

describe('detectIconType (REQ-CONN-071)', () => {
  it.each([
    [
      'PNG',
      bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0),
      'image/png',
    ],
    ['JPEG', bytes(0xff, 0xd8, 0xff, 0xe0), 'image/jpeg'],
    ['GIF', text('GIF89a....'), 'image/gif'],
    ['WebP', text('RIFF\u0000\u0000\u0000\u0000WEBPVP8 '), 'image/webp'],
    ['ICO', bytes(0x00, 0x00, 0x01, 0x00, 0x01), 'image/vnd.microsoft.icon'],
    ['SVG', text('<svg xmlns="http://www.w3.org/2000/svg"/>'), 'image/svg+xml'],
    [
      'SVG with a declaration and a comment',
      text(
        '﻿<?xml version="1.0"?>\n<!-- logo -->\n<svg viewBox="0 0 1 1"></svg>',
      ),
      'image/svg+xml',
    ],
  ])('detects %s', (_name, input, expected) => {
    expect(detectIconType(input)).toBe(expected);
  });

  it.each([
    ['HTML', text('<!doctype html><html><body>Not found</body></html>')],
    ['JSON', text('{"error":"not found"}')],
    ['empty bytes', new Uint8Array()],
    ['text that mentions svg later', text('hello <svg></svg>')],
    ['invalid UTF-8', bytes(0xc3, 0x28, 0x3c, 0x73, 0x76, 0x67)],
  ])('refuses %s', (_name, input) => {
    expect(detectIconType(input)).toBeNull();
  });

  it('refuses more than 256 KB, even with a PNG signature', () => {
    const big = new Uint8Array(MAX_ICON_BYTES + 1);
    big.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    expect(detectIconType(big)).toBeNull();
  });
});
