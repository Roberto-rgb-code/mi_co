import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get()
  getHello(): { message: string; version: string } {
    return {
      message: 'Isuzu Cotizador API',
      version: '1.0.0',
    };
  }

  @Get('health')
  health(): { status: string } {
    return { status: 'ok' };
  }
}
