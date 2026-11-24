import { z } from 'zod';

// A catalog auth option's URL may hold placeholders such as
// `https://mcp.dev.azure.com/{organization}`. Each connection stores the
// values and gets the URL with them filled in (T22).

const PLACEHOLDER = /\{([a-z][a-zA-Z0-9]*)\}/g;

// A value is one URL path segment: letters, digits, dots, underscores and
// hyphens, starting and ending with a letter or digit. It cannot change the
// host or add a path, query or fragment.
const SEGMENT = /^[A-Za-z0-9](?:[A-Za-z0-9._-]{0,98}[A-Za-z0-9])?$/;

export const urlParametersSchema = z.record(z.string(), z.string());
export type UrlParameters = z.infer<typeof urlParametersSchema>;

// The placeholder names in the URL, in order, each once.
export function templateParameters(url: string): string[] {
  return [...new Set([...url.matchAll(PLACEHOLDER)].map((m) => m[1] ?? ''))];
}

export function isUrlParameterValue(value: string): boolean {
  return SEGMENT.test(value);
}

// The URL with every placeholder filled in, or null when a value is missing
// or not a path segment.
export function fillTemplate(
  url: string,
  values: UrlParameters,
): string | null {
  let missing = false;
  const filled = url.replace(PLACEHOLDER, (_, name: string) => {
    const value = values[name];
    if (value === undefined || !isUrlParameterValue(value)) {
      missing = true;
      return '';
    }
    return encodeURIComponent(value);
  });
  return missing ? null : filled;
}

// The origin of a URL that may hold placeholders in its path, for the
// icon of a catalog entry.
export function templateOrigin(url: string): string {
  return new URL(url.replace(PLACEHOLDER, 'x')).origin;
}
