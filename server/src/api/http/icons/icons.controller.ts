import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { Response } from 'express';
import { NotFoundError } from '../../../errors/domain-errors.js';
import {
  IconsService,
  letterIconSvg,
} from '../../../services/icons/icons.service.js';

// REQ-CONN-071: icons are served from OneDoor's own origin. The headers stop
// a browser from running anything in an SVG or guessing another type.
const ICON_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'",
};

@Controller('icons')
export class IconsController {
  constructor(private readonly iconsService: IconsService) {}

  @Get('letter/:letter')
  @Header('Content-Type', 'image/svg+xml')
  @Header('X-Content-Type-Options', ICON_HEADERS['X-Content-Type-Options'])
  @Header('Content-Security-Policy', ICON_HEADERS['Content-Security-Policy'])
  @Header('Cache-Control', 'public, max-age=86400')
  letter(@Param('letter') letter: string): string {
    if (!/^[A-Z0-9]$/.test(letter)) throw new NotFoundError('Icon not found');
    return letterIconSvg(letter);
  }

  @Get(':id')
  async icon(@Param('id') id: string, @Res() res: Response): Promise<void> {
    const icon = await this.iconsService.get(id);
    res
      .set({
        ...ICON_HEADERS,
        'Content-Type': icon.contentType,
        // An icon row never changes; a new icon gets a new id.
        'Cache-Control': 'public, max-age=31536000, immutable',
      })
      .send(Buffer.from(icon.bytes));
  }
}
