import { Controller, Get } from '@nestjs/common';
import { CarroceriasService } from './carrocerias.service';

@Controller('api/carrocerias')
export class CarroceriasController {
  constructor(private readonly svc: CarroceriasService) {}

  @Get()
  async list() {
    return this.svc.findAll();
  }
}
