/**
 * Sincroniza interior_carga_2 en catalog_data.json desde largo/ancho/alto aplicación (Excel DATOS 2).
 * Interior = exterior − 10 cm por dimensión (5 cm pared cada lado).
 */
const fs = require('fs');
const path = require('path');

const WALL = 0.05;

function interiorFromExt(l, w, h) {
  return {
    largo_cm: Math.round(Math.max(50, (l - 2 * WALL) * 100)),
    ancho_cm: Math.round(Math.max(50, (w - 2 * WALL) * 100)),
    alto_cm: Math.round(Math.max(50, (h - 2 * WALL) * 100)),
  };
}

const paths = [
  path.join(__dirname, '..', 'frontend', 'public', 'catalog_data.json'),
  path.join(__dirname, '..', 'catalog_data.json'),
];

for (const p of paths) {
  if (!fs.existsSync(p)) continue;
  const data = JSON.parse(fs.readFileSync(p, 'utf-8'));
  let n = 0;
  for (const mod of Object.values(data.modelos || {})) {
    const l = mod.largo_aplicacion;
    const w = mod.ancho_aplicacion;
    const h = mod.alto_aplicacion;
    if (l == null || w == null || h == null) continue;
    mod.cubicaje_peso = mod.cubicaje_peso || {};
    mod.cubicaje_peso.interior_carga_2 = interiorFromExt(l, w, h);
    n++;
  }
  fs.writeFileSync(p, JSON.stringify(data, null, 2) + '\n', 'utf-8');
  console.log('Updated', n, 'models in', p);
}
