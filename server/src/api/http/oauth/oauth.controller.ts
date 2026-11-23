import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { OAuthService } from '../../../services/upstreams/auth/oauth/oauth.service.js';

// The OAuth redirect URI (T21). The authorization server sends the owner's
// browser here with a code and the state; OAuthService finishes the flow and
// this route sends the browser on to the server's page in web.
@Controller('oauth')
export class OAuthController {
  constructor(private readonly oauthService: OAuthService) {}

  @Get('callback')
  async callback(@Req() req: Request, @Res() res: Response): Promise<void> {
    // The raw query, so a repeated parameter is not turned into an array.
    const params = new URL(req.originalUrl, 'http://callback').searchParams;
    const target = await this.oauthService.finish(params);
    res
      .set({
        // The URL carried a code: keep it out of caches and Referer headers.
        'Cache-Control': 'no-store',
        'Referrer-Policy': 'no-referrer',
      })
      .redirect(302, target);
  }
}
