import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Cliente } from '../entities/cliente.entity';

export interface CreateClienteDto {
  nombre: string;
  email: string;
  telefono?: string;
  empresa?: string;
  productoTransportar?: string;
  cantidadTarimas?: number;
  tarimaLargo?: number;
  tarimaAncho?: number;
  tarimaAlto?: number;
  pesoEstimadoKg?: number;
  requerimientos?: string;
  modeloRecomendado?: string;
  notaNecesidades?: string;
}

export type UpdateClienteDto = Partial<CreateClienteDto>;

@Injectable()
export class ClientesService {
  constructor(
    @InjectRepository(Cliente)
    private readonly repo: Repository<Cliente>,
  ) {}

  async findAll(): Promise<Cliente[]> {
    return this.repo.find({
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Cliente> {
    const c = await this.repo.findOne({ where: { id } });
    if (!c) throw new NotFoundException(`Cliente ${id} no encontrado`);
    return c;
  }

  async create(dto: CreateClienteDto): Promise<Cliente> {
    const entity = this.repo.create(dto);
    return this.repo.save(entity);
  }

  async update(id: string, dto: UpdateClienteDto): Promise<Cliente> {
    const c = await this.findOne(id);
    Object.assign(c, dto);
    return this.repo.save(c);
  }

  async remove(id: string): Promise<void> {
    const c = await this.findOne(id);
    await this.repo.remove(c);
  }

  /** Genera contexto compacto del cliente para el chatbot */
  getContextoParaChatbot(cliente: Cliente): string {
    const parts: string[] = [
      `Cliente: ${cliente.nombre}`,
      cliente.empresa ? `Empresa: ${cliente.empresa}` : null,
      cliente.productoTransportar ? `Producto a transportar: ${cliente.productoTransportar}` : null,
      cliente.cantidadTarimas ? `Cantidad de tarimas: ${cliente.cantidadTarimas}` : null,
      cliente.tarimaLargo && cliente.tarimaAncho
        ? `Dimensiones tarima: ${cliente.tarimaLargo}m x ${cliente.tarimaAncho}m${cliente.tarimaAlto ? ` x ${cliente.tarimaAlto}m alto` : ''}`
        : null,
      cliente.pesoEstimadoKg ? `Peso estimado: ${cliente.pesoEstimadoKg} kg` : null,
      cliente.requerimientos ? `Requerimientos: ${cliente.requerimientos}` : null,
      cliente.notaNecesidades ? `Necesidades: ${cliente.notaNecesidades}` : null,
      cliente.modeloRecomendado ? `Modelo ya sugerido: ${cliente.modeloRecomendado}` : null,
    ].filter(Boolean) as string[];
    return parts.join('. ');
  }
}
