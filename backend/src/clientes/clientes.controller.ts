import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { ClientesService, CreateClienteDto, UpdateClienteDto } from './clientes.service';
import {
  DistribucionService,
  type DistribucionInput,
} from './distribucion.service';

@Controller('api/clientes')
export class ClientesController {
  constructor(
    private readonly clientes: ClientesService,
    private readonly distribucionService: DistribucionService,
  ) {}

  @Get()
  async list() {
    return this.clientes.findAll();
  }

  @Post('distribucion')
  calcularDistribucion(@Body() input: DistribucionInput) {
    const result = this.distribucionService.calcular(input);
    const svg = this.distribucionService.generarSvg(result, input);
    return { ...result, svg };
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    return this.clientes.findOne(id);
  }

  @Post()
  async create(@Body() dto: CreateClienteDto) {
    return this.clientes.create(dto);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: UpdateClienteDto) {
    return this.clientes.update(id, dto);
  }

  @Delete(':id')
  async remove(@Param('id') id: string) {
    await this.clientes.remove(id);
    return { ok: true };
  }
}
