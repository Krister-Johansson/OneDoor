import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { z } from 'zod';
import { NotFoundError } from '../../errors/domain-errors.js';
import { findNetworkRuleError, GuardedFetch } from '../../net/guarded-fetch.js';
import { PrismaService } from '../../prisma/prisma.service.js';
import { toDomainError } from '../../prisma/prisma-error.mapper.js';
import { detectIconType, MAX_ICON_BYTES } from './icon-format.js';

const FETCH_TIMEOUT_MS = 5_000;

export interface StoredIcon {
  contentType: string;
  bytes: Uint8Array;
}

// The URL path of an icon. Without a stored icon it is the generated letter
// icon for the display name (REQ-CONN-070).
export function iconPath(iconId: string | null, displayName: string): string {
  return iconId === null
    ? `/icons/letter/${iconLetter(displayName)}`
    : `/icons/${iconId}`;
}

// The first letter or digit of a name, without accents, upper-cased.
export function iconLetter(name: string): string {
  const match = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .match(/[A-Z0-9]/);
  return match?.[0] ?? 'S';
}

@Injectable()
export class IconsService {
  private readonly logger = new Logger(IconsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly guardedFetch: GuardedFetch,
  ) {}

  // Tries each URL in order and stores the first one that is an allowed
  // icon (REQ-CONN-071). Returns the icon id, or null when none works.
  async fetchFirst(urls: readonly string[]): Promise<string | null> {
    const fetch = this.guardedFetch.create();
    for (const url of urls) {
      const bytes = await this.download(fetch, url);
      if (!bytes) continue;
      const contentType = detectIconType(bytes);
      if (!contentType) {
        this.logger.debug(`Not an allowed icon: ${url}`);
        continue;
      }
      return this.store(contentType, bytes);
    }
    return null;
  }

  async get(id: string): Promise<StoredIcon> {
    if (!z.uuid().safeParse(id).success)
      throw new NotFoundError('Icon not found');
    let icon: StoredIcon | null;
    try {
      icon = await this.prisma.icon.findUnique({
        where: { id },
        select: { contentType: true, bytes: true },
      });
    } catch (error) {
      throw toDomainError(error, 'Icon');
    }
    if (!icon) throw new NotFoundError('Icon not found');
    return icon;
  }

  private async download(
    fetch: ReturnType<GuardedFetch['create']>,
    url: string,
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    try {
      const response = await fetch(url, {
        headers: { accept: 'image/*' },
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
      if (response.status !== 200) {
        await response.body?.cancel();
        return null;
      }
      const length = Number(response.headers.get('content-length') ?? 0);
      if (length > MAX_ICON_BYTES) {
        await response.body?.cancel();
        return null;
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      return bytes.length > MAX_ICON_BYTES ? null : bytes;
    } catch (error) {
      const rule = findNetworkRuleError(error);
      this.logger.debug(
        `Icon fetch failed for ${url}: ${rule ? rule.message : 'no usable answer'}`,
      );
      return null;
    }
  }

  // Icons with the same bytes share one row. Two refreshes can store the
  // same bytes at once, and Prisma's upsert reads and then inserts, so the
  // later insert would fail on the unique sha256. skipDuplicates makes the
  // insert ON CONFLICT DO NOTHING; the read then finds whichever row won.
  private async store(
    contentType: string,
    bytes: Uint8Array<ArrayBuffer>,
  ): Promise<string> {
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    try {
      await this.prisma.icon.createMany({
        data: { sha256, contentType, bytes },
        skipDuplicates: true,
      });
      const icon = await this.prisma.icon.findUniqueOrThrow({
        where: { sha256 },
        select: { id: true },
      });
      return icon.id;
    } catch (error) {
      throw toDomainError(error, 'Icon');
    }
  }
}

// A generated icon: the letter in white on a color chosen by the letter.
export function letterIconSvg(letter: string): string {
  const colors = [
    '#2563eb',
    '#7c3aed',
    '#db2777',
    '#ea580c',
    '#16a34a',
    '#0891b2',
  ];
  const color = colors[letter.charCodeAt(0) % colors.length];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="12" fill="${color}"/><text x="32" y="43" font-family="system-ui, sans-serif" font-size="30" font-weight="600" fill="#ffffff" text-anchor="middle">${letter}</text></svg>`;
}
