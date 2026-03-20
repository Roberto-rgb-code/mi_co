#!/usr/bin/env node
/**
 * Crea la tabla clientes en PostgreSQL.
 * Ejecutar: node scripts/run-migration-clientes.js
 * Requiere DATABASE_URL en .env
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const sqlPath = path.join(__dirname, 'sql', '001_create_clientes.sql');
const sql = fs.readFileSync(sqlPath, 'utf-8');

async function run() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL no definida en .env');
    process.exit(1);
  }
  const client = new Client({ connectionString: url, ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false });
  await client.connect();
  await client.query(sql);
  await client.end();
  console.log('Tabla clientes creada correctamente.');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
