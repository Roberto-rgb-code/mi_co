import { Module } from '@nestjs/common';
import { CubicajeAssistantService } from './cubicaje-assistant.service';
import { CubicajeController } from './cubicaje.controller';
import { CubicajeService } from './cubicaje.service';

@Module({
  controllers: [CubicajeController],
  providers: [CubicajeService, CubicajeAssistantService],
  exports: [CubicajeService],
})
export class CubicajeModule {}
