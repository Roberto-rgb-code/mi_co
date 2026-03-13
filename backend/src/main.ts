import * as dotenv from 'dotenv';
import { join } from 'path';

// Cargar .env desde la raíz (solo en local; Railway inyecta las variables)
dotenv.config({ path: join(__dirname, '..', '..', '.env') });

if (!process.env.DATABASE_URL) {
  console.error('❌ DATABASE_URL no está definida.');
  console.error('   En Railway: Variables → New Variable → Add Reference → PostgreSQL → DATABASE_URL');
  process.exit(1);
}

import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const port = process.env.PORT || 3000;
  app.enableCors();
  await app.listen(port);
  console.log(`🚀 Backend corriendo en http://localhost:${port}`);
}

bootstrap();
