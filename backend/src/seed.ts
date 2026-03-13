/**
 * Seed inicial - ejecutar con: npx ts-node -r dotenv/config src/seed.ts
 * Inserta modelos de ejemplo desde el catálogo ELF/Forward
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Cargar .env (raíz o backend)
dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no encontrada. Crea .env en la raíz con DATABASE_URL.');
  process.exit(1);
}

import { Modelo } from './entities/modelo.entity';

const dataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  entities: [Modelo],
  synchronize: false,
});

const modelosSeed = [
  { catalogo: 'ELF 100E', familia: 'ELF', nomenclatura: '100', precio: 766800, capacidadCarga: '1.8 T', kmPorLitro: '11 KM/LT' },
  { catalogo: 'ELF 200E', familia: 'ELF', nomenclatura: '200', precio: 935100, capacidadCarga: '2.6 T', kmPorLitro: '10 KM/LT' },
  { catalogo: 'ELF 300E', familia: 'ELF', nomenclatura: '300', precio: 1032100, capacidadCarga: '3.5 T', kmPorLitro: '9 KM/LT' },
  { catalogo: 'ELF 400F', familia: 'ELF', nomenclatura: '400', precio: 1160200, capacidadCarga: '4 T', kmPorLitro: '7 KM/LT' },
  { catalogo: 'ELF 500F', familia: 'ELF', nomenclatura: '500', precio: 1248100, capacidadCarga: '5 T', kmPorLitro: '6 KM/LT' },
  { catalogo: 'ELF 600H', familia: 'ELF', nomenclatura: '600', precio: 1321300, capacidadCarga: '6 T', kmPorLitro: '6 KM/LT' },
  { catalogo: 'FORWARD 800K', familia: 'FORWARD', nomenclatura: '800', precio: 1459800, capacidadCarga: '7 T', kmPorLitro: '5.5 KM/LT' },
  { catalogo: 'FORWARD 1100L', familia: 'FORWARD', nomenclatura: '1100', precio: 1702800, capacidadCarga: '10 T', kmPorLitro: '4.5 KM/LT' },
  { catalogo: 'FORWARD 1400Q', familia: 'FORWARD', nomenclatura: '1400', precio: 1830600, capacidadCarga: '12 T', kmPorLitro: '4.5 KM/LT' },
];

async function run() {
  await dataSource.initialize();
  const repo = dataSource.getRepository(Modelo);
  for (const m of modelosSeed) {
    const existing = await repo.findOne({ where: { catalogo: m.catalogo } });
    if (!existing) {
      await repo.save(m);
      console.log('Inserted:', m.catalogo);
    }
  }
  await dataSource.destroy();
  console.log('Seed completado.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
