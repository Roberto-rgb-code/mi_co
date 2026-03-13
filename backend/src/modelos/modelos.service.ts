import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Modelo } from '../entities/modelo.entity';

@Injectable()
export class ModelosService {
  constructor(
    @InjectRepository(Modelo)
    private readonly modeloRepo: Repository<Modelo>,
  ) {}

  async findAll() {
    return this.modeloRepo.find({
      order: { catalogo: 'ASC' },
    });
  }
}
