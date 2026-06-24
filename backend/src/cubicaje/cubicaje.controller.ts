import { Body, Controller, Post } from '@nestjs/common';
import {
  CubicajeAssistantService,
  type CubicajeAsistenteInput,
} from './cubicaje-assistant.service';
import { CubicajeService, type CubicajeInput } from './cubicaje.service';

@Controller('api/cubicaje')
export class CubicajeController {
  constructor(
    private readonly cubicaje: CubicajeService,
    private readonly asistente: CubicajeAssistantService,
  ) {}

  @Post('calcular')
  calcular(@Body() input: CubicajeInput) {
    return this.cubicaje.calcular(input);
  }

  @Post('recomendar-modelo')
  recomendarModelo(@Body() body: { bultos: CubicajeInput['bultos'] }) {
    const fit = this.cubicaje.findSmallestFittingModelo(body.bultos || []);
    if (!fit) return { modelo: null };
    return fit;
  }

  @Post('asistente')
  asistenteCarga(@Body() body: CubicajeAsistenteInput) {
    return this.asistente.parseCarga(body);
  }
}
