import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config({ path: require('path').join(__dirname, '../../../.env') });

// Configuración para migraciones (TypeORM CLI)
export default new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity{.ts,.js}'],
  migrations: ['src/migrations/*{.ts,.js}'],
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});
