import { Body, Controller, HttpCode, Post } from '@nestjs/common';
import { ComparativaService } from './comparativa.service';

@Controller('api/comparativa')
export class ComparativaController {
  constructor(private readonly comparativa: ComparativaService) {}

  @Post()
  @HttpCode(200)
  async comparar(@Body() body: { competidor?: string }) {
    const competidor = typeof body?.competidor === 'string' ? body.competidor : '';
    return this.comparativa.comparar(competidor);
  }
}
