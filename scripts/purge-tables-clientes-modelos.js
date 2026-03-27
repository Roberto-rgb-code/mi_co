#!/usr/bin/env node
/**
 * Elimina tablas clientes y modelos (solo lo creado por este proyecto).
 * Uso: DATABASE_URL="postgresql://..." node scripts/purge-tables-clientes-modelos.js
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config();
const { Client } = require('pg');

async function run() {
  const url = process.env.PURGE_DATABASE_URL || process.env.DATABASE_URL;
  if (!url) {
    console.error('Define PURGE_DATABASE_URL o DATABASE_URL');
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: url.includes('railway') || process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  await client.query('DROP TABLE IF EXISTS clientes CASCADE');
  await client.query('DROP TABLE IF EXISTS modelos CASCADE');
  await client.query('DROP TABLE IF EXISTS carrocerias_tipo CASCADE');
  await client.end();
  console.log('Tablas clientes, modelos y carrocerias_tipo eliminadas.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
