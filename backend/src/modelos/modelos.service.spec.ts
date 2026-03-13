import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Modelo } from '../entities/modelo.entity';
import { ModelosService } from './modelos.service';

describe('ModelosService', () => {
  let service: ModelosService;

  const mockRepository = {
    find: jest.fn().mockResolvedValue([
      { id: '1', catalogo: 'ELF 100E', familia: 'ELF', precio: 766800 },
    ]),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelosService,
        {
          provide: getRepositoryToken(Modelo),
          useValue: mockRepository,
        },
      ],
    }).compile();

    service = module.get<ModelosService>(ModelosService);
    mockRepository.find.mockClear();
  });

  it('debe estar definido', () => {
    expect(service).toBeDefined();
  });

  it('findAll debe retornar array de modelos', async () => {
    const result = await service.findAll();
    expect(result).toHaveLength(1);
    expect(result[0].catalogo).toBe('ELF 100E');
    expect(mockRepository.find).toHaveBeenCalled();
  });
});
