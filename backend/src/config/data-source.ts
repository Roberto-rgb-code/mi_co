import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar .env solo en local (Railway inyecta DATABASE_URL directamente)
dotenv.config();
dotenv.config({ path: path.join(process.cwd(), '../.env') });
dotenv.config({ path: path.join(__dirname, '../../../.env') });

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL no definida. En Railway, añade la variable en Settings > Variables.');
}

// Configuración para migraciones (TypeORM CLI)
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
