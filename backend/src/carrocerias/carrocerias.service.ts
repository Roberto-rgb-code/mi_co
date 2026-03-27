import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CarroceriaTipo } from '../entities/carroceria-tipo.entity';

@Injectable()
export class CarroceriasService {
  constructor(
    @InjectRepository(CarroceriaTipo)
    private readonly repo: Repository<CarroceriaTipo>,
  ) {}

  async findAll(): Promise<CarroceriaTipo[]> {
    return this.repo.find({ order: { orden: 'ASC' } });
  }
}
