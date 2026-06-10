import { Module } from '@nestjs/common';
import { CubicajeController } from './cubicaje.controller';
import { CubicajeService } from './cubicaje.service';

@Module({
  controllers: [CubicajeController],
  providers: [CubicajeService],
  exports: [CubicajeService],
})
export class CubicajeModule {}
