import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Cliente } from '../entities/cliente.entity';
import { ClientesController } from './clientes.controller';
import { ClientesService } from './clientes.service';
import { DistribucionService } from './distribucion.service';
import { DistribucionPreviewController } from './distribucion-preview.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Cliente])],
  controllers: [ClientesController, DistribucionPreviewController],
  providers: [ClientesService, DistribucionService],
  exports: [ClientesService, DistribucionService],
})
export class ClientesModule {}
