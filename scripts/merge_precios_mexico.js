#!/usr/bin/env node
/**
 * Actualiza catalog_data.json con precios oficiales México MY27
 * (ANEXO 1 TC 20.00, Plan Marzo 2026, isuzumex.com.mx)
 */
const fs = require('fs');
const path = require('path');

const catalogPath = path.join(__dirname, '..', 'frontend', 'public', 'catalog_data.json');
const preciosPath = path.join(__dirname, '..', 'frontend', 'public', 'precios_mexico_my27.json');

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf-8'));
const precios = JSON.parse(fs.readFileSync(preciosPath, 'utf-8'));

const modelos = precios.modelos || {};
let updated = 0;
let added = 0;

for (const [key, pm] of Object.entries(modelos)) {
  const p = pm.precio ?? pm.precio_2026;
  if (p == null) continue;

  if (catalog.modelos[key]) {
    catalog.modelos[key].precio = p;
    catalog.modelos[key].precio_2026 = pm.precio_2026 ?? p;
    if (pm.precio_2025 != null) catalog.modelos[key].precio_2025 = pm.precio_2025;
    updated++;
  } else {
    const base = key.startsWith('ELF')
      ? catalog.modelos['ELF 600M'] || catalog.modelos['ELF 600K']
      : catalog.modelos['FORWARD 1400Q'] || catalog.modelos['FORWARD 1400K'];
    const baseCopy = base ? JSON.parse(JSON.stringify(base)) : {};
    catalog.modelos[key] = {
      ...baseCopy,
      modelo: key,
      linea: pm.linea || (key.startsWith('ELF') ? 'ELF' : 'Forward'),
      precio: p,
      precio_2026: pm.precio_2026 ?? p,
      ano_modelo: 2026,
      capacidad_carga: pm.capacidad_carga || baseCopy.capacidad_carga || '—',
    };
    delete catalog.modelos[key].cubicaje_peso;
    delete catalog.modelos[key].distancia_consumo;
    added++;
  }
}

catalog.fuentes = catalog.fuentes || {};
catalog.fuentes.precios_mexico = 'ANEXO 1 TC 20.00 Plan Marzo 2026 (isuzumex.com.mx)';

fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2), 'utf-8');
console.log(`Precios México aplicados: ${updated} actualizados, ${added} nuevos.`);
console.log(`Total modelos: ${Object.keys(catalog.modelos).length}`);
