import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Modelo } from '../entities/modelo.entity';
import { ModelosController } from './modelos.controller';
import { ModelosService } from './modelos.service';

@Module({
  imports: [TypeOrmModule.forFeature([Modelo])],
  controllers: [ModelosController],
  providers: [ModelosService],
})
export class ModelosModule {}
