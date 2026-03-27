import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CarroceriaTipo } from '../entities/carroceria-tipo.entity';
import { CarroceriasController } from './carrocerias.controller';
import { CarroceriasService } from './carrocerias.service';

@Module({
  imports: [TypeOrmModule.forFeature([CarroceriaTipo])],
  controllers: [CarroceriasController],
  providers: [CarroceriasService],
  exports: [CarroceriasService],
})
export class CarroceriasModule {}
