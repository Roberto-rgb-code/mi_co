import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ModelosModule } from '../modelos/modelos.module';
import { CarroceriasModule } from '../carrocerias/carrocerias.module';

@Module({
  imports: [ModelosModule, CarroceriasModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
