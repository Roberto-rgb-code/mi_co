import { Module } from '@nestjs/common';
import { AssistantController } from './assistant.controller';
import { AssistantService } from './assistant.service';
import { ModelosModule } from '../modelos/modelos.module';

@Module({
  imports: [ModelosModule],
  controllers: [AssistantController],
  providers: [AssistantService],
})
export class AssistantModule {}
