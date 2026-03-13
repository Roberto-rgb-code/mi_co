import { Controller, Get } from '@nestjs/common';
import { ModelosService } from './modelos.service';

@Controller('api/modelos')
export class ModelosController {
  constructor(private readonly modelosService: ModelosService) {}

  @Get()
  findAll() {
    return this.modelosService.findAll();
  }
}
