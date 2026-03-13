import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';

describe('AppController', () => {
  let controller: AppController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
    }).compile();

    controller = module.get<AppController>(AppController);
  });

  it('debe retornar mensaje de bienvenida', () => {
    const result = controller.getHello();
    expect(result).toHaveProperty('message', 'Isuzu Cotizador API');
    expect(result).toHaveProperty('version');
  });

  it('debe retornar health ok', () => {
    const result = controller.health();
    expect(result).toEqual({ status: 'ok' });
  });
});
