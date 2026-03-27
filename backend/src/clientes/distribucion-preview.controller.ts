import { BadRequestException, Controller, Get, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { DistribucionService, type DistribucionInput } from './distribucion.service';

/**
 * Sirve el SVG de distribución de tarimas para mostrarlo en el chat (markdown ![...](url)).
 */
@Controller('api/distribucion')
export class DistribucionPreviewController {
  constructor(private readonly distribucion: DistribucionService) {}

  @Get('preview.svg')
  preview(
    @Res() res: Response,
    @Query('modelo') modelo: string,
    @Query('cantidadTarimas') cantidadTarimas: string,
    @Query('tarimaLargo') tarimaLargo?: string,
    @Query('tarimaAncho') tarimaAncho?: string,
  ) {
    const m = (modelo || '').trim();
    if (!m) {
      throw new BadRequestException('Parámetro modelo requerido');
    }
    const n = Math.min(99, Math.max(1, parseInt(cantidadTarimas || '1', 10) || 1));
    const input: DistribucionInput = {
      modelo: m,
      cantidadTarimas: n,
      tarimaLargo: tarimaLargo != null && tarimaLargo !== '' ? parseFloat(tarimaLargo) : undefined,
      tarimaAncho: tarimaAncho != null && tarimaAncho !== '' ? parseFloat(tarimaAncho) : undefined,
    };
    const result = this.distribucion.calcular(input);
    const svg = this.distribucion.generarSvg(result, input);
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    return res.send(svg);
  }
}
