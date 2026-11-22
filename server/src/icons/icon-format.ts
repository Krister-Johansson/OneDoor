// REQ-CONN-071: an icon is at most 256 KB and one of these types, read from
// the bytes, never from the Content-Type a server declares.
export const MAX_ICON_BYTES = 256 * 1024;

export type IconContentType =
  | 'image/png'
  | 'image/jpeg'
  | 'image/webp'
  | 'image/gif'
  | 'image/vnd.microsoft.icon'
  | 'image/svg+xml';

function startsWith(bytes: Uint8Array, prefix: number[], offset = 0): boolean {
  return prefix.every((value, i) => bytes[offset + i] === value);
}

const ascii = (text: string) => [...text].map((c) => c.charCodeAt(0));

// The icon type of `bytes`, or null when they are not an allowed image.
export function detectIconType(bytes: Uint8Array): IconContentType | null {
  if (bytes.length === 0 || bytes.length > MAX_ICON_BYTES) return null;
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) {
    return 'image/png';
  }
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (
    startsWith(bytes, ascii('GIF87a')) ||
    startsWith(bytes, ascii('GIF89a'))
  ) {
    return 'image/gif';
  }
  if (startsWith(bytes, ascii('RIFF')) && startsWith(bytes, ascii('WEBP'), 8)) {
    return 'image/webp';
  }
  if (startsWith(bytes, [0x00, 0x00, 0x01, 0x00])) {
    return 'image/vnd.microsoft.icon';
  }
  return isSvg(bytes) ? 'image/svg+xml' : null;
}

// An SVG document: text whose first element is <svg>, after an optional
// byte order mark, XML declaration, doctype and comments.
function isSvg(bytes: Uint8Array): boolean {
  let text: string;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return false;
  }
  const start = text
    .replace(/^﻿/, '')
    .replace(/^\s*<\?xml[^>]*\?>/i, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '')
    .replace(/^\s*<!DOCTYPE svg[^>]*>/i, '')
    .replace(/^(\s*<!--[\s\S]*?-->)*/, '')
    .trimStart();
  return /^<svg[\s>]/i.test(start);
}
