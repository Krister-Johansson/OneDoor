import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationBootstrap,
} from '@nestjs/common';
import type { ConfigType } from '@nestjs/config';
import { iconsConfig } from '../../../config/icons.config.js';
import { PrismaService } from '../../../prisma/prisma.service.js';
import { IconsService } from '../../icons/icons.service.js';
import { templateOrigin, templateParameters } from '../catalog/url-template.js';
import { ProbeService } from '../probe/probe.service.js';

// Finds and stores server icons (REQ-CONN-070) in the background, so no
// request waits for another host. Without a stored icon the letter icon
// applies.
@Injectable()
export class IconRefreshService implements OnApplicationBootstrap {
  private readonly logger = new Logger(IconRefreshService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly probeService: ProbeService,
    private readonly iconsService: IconsService,
    @Inject(iconsConfig.KEY)
    private readonly icons: ConfigType<typeof iconsConfig>,
  ) {}

  // Catalog entries without an icon get one, using their first auth option.
  onApplicationBootstrap(): void {
    if (!this.icons.fetching) return;
    this.refreshCatalog().catch((error: unknown) =>
      this.logger.warn(`Catalog icon refresh failed: ${String(error)}`),
    );
  }

  // Called when a custom connection is created or its URL changes.
  refreshConnectionInBackground(connectionId: string, url: string): void {
    if (!this.icons.fetching) return;
    this.refreshConnection(connectionId, url).catch((error: unknown) =>
      this.logger.warn(
        `Icon refresh failed for connection ${connectionId}: ${String(error)}`,
      ),
    );
  }

  async refreshConnection(connectionId: string, url: string): Promise<void> {
    const iconId = await this.findIcon(url);
    // The URL condition keeps a slow refresh from overwriting the icon of a
    // URL that changed in the meantime.
    await this.prisma.connection.updateMany({
      where: { id: connectionId, url },
      data: { iconId },
    });
  }

  async refreshCatalog(): Promise<void> {
    const entries = await this.prisma.catalogEntry.findMany({
      where: { iconId: null },
      include: { authOptions: { orderBy: { authType: 'asc' }, take: 1 } },
    });
    for (const entry of entries) {
      const url = entry.authOptions[0]?.url;
      if (!url) continue;
      // A URL with placeholders (T22) is no server to probe; its origin may
      // still have a favicon.
      const iconId =
        templateParameters(url).length > 0
          ? await this.iconsService.fetchFirst([
              new URL('/favicon.ico', templateOrigin(url)).href,
            ])
          : await this.findIcon(url);
      if (iconId) {
        await this.prisma.catalogEntry.update({
          where: { id: entry.id },
          data: { iconId },
        });
      }
    }
  }

  // REQ-CONN-070: the server's own MCP icons, then the favicon of its origin.
  private async findIcon(serverUrl: string): Promise<string | null> {
    const candidates: string[] = [];
    try {
      const probe = await this.probeService.probe(serverUrl);
      candidates.push(...probe.iconUrls);
    } catch {
      // A URL the rules refuse has no icon to find.
      return null;
    }
    candidates.push(new URL('/favicon.ico', serverUrl).href);
    return this.iconsService.fetchFirst(candidates);
  }
}
