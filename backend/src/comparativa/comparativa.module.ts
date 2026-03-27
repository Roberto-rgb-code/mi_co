import { Module } from '@nestjs/common';
import { ComparativaController } from './comparativa.controller';
import { ComparativaService } from './comparativa.service';
import { ModelosModule } from '../modelos/modelos.module';

@Module({
  imports: [ModelosModule],
  controllers: [ComparativaController],
  providers: [ComparativaService],
})
export class ComparativaModule {}
