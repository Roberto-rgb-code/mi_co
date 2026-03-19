import * as dotenv from 'dotenv';
import { join } from 'path';
import { existsSync } from 'fs';
import * as express from 'express';

// Cargar .env desde la raíz (solo en local; Railway inyecta las variables)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida.');
  console.error('   En Railway: Variables → New Variable → Add Reference → PostgreSQL → DATABASE_URL');
  process.exit(1);
}

import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from './app.module';

async function bootstrap() {
  const frontendDist = join(__dirname, '..', '..', 'frontend', 'dist');
  if (!existsSync(join(frontendDist, 'index.html'))) {
    console.error('❌ No existe frontend/dist/index.html');
    console.error('   Desde la raíz del repo: npm run frontend:build');
  }

  /**
   * Los estáticos de Vite DEBEN registrarse ANTES de que Nest monte el router.
   * Si no, @Get('*') o el orden de middleware puede responder 404 a /assets/*.js
   * (pantalla en blanco al cargar la SPA).
   */
  const server = express();
  server.use(
    express.static(frontendDist, {
      index: false,
      fallthrough: true,
    }),
  );

  const adapter = new ExpressAdapter(server);
  const app = await NestFactory.create(AppModule, adapter);
  const port = process.env.PORT || 3000;
  app.enableCors();
  await app.listen(port);
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
  console.log(`📁 Frontend estático: ${frontendDist}`);
}

bootstrap();
