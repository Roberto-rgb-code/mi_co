#!/usr/bin/env node
/**
 * Ejecuta migraciones SQL en orden (001_, 002_, …).
 * Ejecutar: node scripts/run-migration-clientes.js
 * Requiere DATABASE_URL en .env
 */
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlDir = path.join(__dirname, 'sql');
const files = fs
  .readdirSync(sqlDir)
  .filter((f) => f.endsWith('.sql'))
  .sort();

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida en .env');
    process.exit(1);
  }
  const client = new Client({
    connectionString: url,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  });
  await client.connect();
  for (const f of files) {
    const sql = fs.readFileSync(path.join(sqlDir, f), 'utf-8');
    await client.query(sql);
    console.log('OK:', f);
  }
  await client.end();
  console.log('Migraciones SQL completadas.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
