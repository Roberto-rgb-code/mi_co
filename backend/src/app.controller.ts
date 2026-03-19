import { Controller, Get, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { join } from 'path';

/** Mismo path que express.static en main.ts (dist del build de Vite) */
const FRONTEND_DIST = join(__dirname, '..', '..', 'frontend', 'dist');

@Controller()
export class AppController {
  @Get('api')
  getApiInfo(): { message: string; version: string } {
    return {
      message: 'Isuzu Cotizador API',
      version: '1.0.0',
    };
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }

  /**
   * SPA: al refrescar en /catalogo, /login, etc. el servidor debe devolver index.html
   * para que React Router resuelva la ruta (tras express.static con fallthrough en main.ts).
   */
  @Get('*')
  spaFallback(@Req() req: Request, @Res() res: Response) {
    if (req.path.startsWith('/api')) {
      return res.status(404).json({
        message: `Cannot GET ${req.path}`,
        error: 'Not Found',
        statusCode: 404,
      });
    }
    const last = req.path.split('.').pop() ?? '';
    const assetExts = new Set([
      'js',
      'css',
      'map',
      'ico',
      'png',
      'jpg',
      'jpeg',
      'gif',
      'svg',
      'woff',
      'woff2',
      'ttf',
      'webp',
      'json',
      'webmanifest',
    ]);
    if (last && assetExts.has(last)) {
      return res.status(404).end();
    }
    return res.sendFile(join(FRONTEND_DIST, 'index.html'));
  }
}
