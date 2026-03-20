/**
 * Seed México - sincroniza catalog_data.json (precios oficiales México MY27) a PostgreSQL.
 * Ejecutar: npm run seed (o desde backend: npx ts-node -r dotenv/config src/seed.ts)
 */
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config();
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(__dirname, '..', '..', '.env') });
if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL no encontrada. Crea .env con DATABASE_URL.');
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

type CatalogModel = {
  modelo?: string;
  linea?: string;
  precio?: number;
  precio_2026?: number;
  capacidad_carga?: string;
  motor?: string;
  hp?: string;
  torque?: string;
  garantia?: string;
  km_litro?: string;
  tecnologia?: string;
  ano_modelo?: number;
};

function extractNomenclatura(catalogo: string): string {
  const match = catalogo.match(/(\d+)/);
  return match ? match[1] : catalogo.replace(/\D/g, '') || '0';
}

async function run() {
  const base = path.resolve(__dirname, '..', '..');
  const catalogPath = path.join(base, 'frontend', 'public', 'catalog_data.json');
  if (!fs.existsSync(catalogPath)) {
    console.error('No existe', catalogPath);
    process.exit(1);
  }
  const raw = fs.readFileSync(catalogPath, 'utf-8');
  const data = JSON.parse(raw) as { modelos?: Record<string, CatalogModel> };
  const modelos = data.modelos || {};
  if (Object.keys(modelos).length === 0) {
    console.error('No hay modelos en catalog_data.json');
    process.exit(1);
  }

  await dataSource.initialize();
  const repo = dataSource.getRepository(Modelo);
  let upserted = 0;
  for (const [key, m] of Object.entries(modelos)) {
    const catalogo = (m.modelo || key).trim();
    const familia = (m.linea || (catalogo.startsWith('ELF') ? 'ELF' : 'FORWARD')).toUpperCase();
    const precio = typeof m.precio === 'number' ? m.precio : (m.precio_2026 as number) ?? 0;
    if (precio <= 0) continue;

    const payload = {
      catalogo,
      familia,
      nomenclatura: extractNomenclatura(catalogo),
      precio,
      yearModelo: m.ano_modelo ?? 2026,
      capacidadCarga: m.capacidad_carga || undefined,
      motor: m.motor || undefined,
      hp: m.hp || undefined,
      torque: m.torque || undefined,
      garantia: m.garantia || undefined,
      kmPorLitro: m.km_litro || undefined,
      tecnologia: m.tecnologia || undefined,
    };

    const existing = await repo.findOne({ where: { catalogo } });
    if (existing) {
      await repo.update(existing.id, payload);
    } else {
      await repo.save(repo.create(payload));
    }
    upserted++;
    console.log(upserted, catalogo);
  }
  await dataSource.destroy();
  console.log(`Seed México: ${upserted} modelos sincronizados.`);
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
