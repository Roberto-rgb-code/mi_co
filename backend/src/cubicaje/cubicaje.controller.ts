import { Body, Controller, Post } from '@nestjs/common';
import { CubicajeService, type CubicajeInput } from './cubicaje.service';

@Controller('api/cubicaje')
export class CubicajeController {
  constructor(private readonly cubicaje: CubicajeService) {}

  @Post('calcular')
  calcular(@Body() input: CubicajeInput) {
    return this.cubicaje.calcular(input);
  }
}
