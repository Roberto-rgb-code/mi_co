/**
 * Valida que catalog_data.json coincida con Excel DATOS 2 (exterior)
 * y que interior = exterior − 10 cm por dimensión.
 */
const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');

const WALL = 0.05;
const TOL = 0.011;

const xlsxDir = path.join(__dirname, '..', 'Distribucion_carga');
const xlsxFile = fs.readdirSync(xlsxDir).find((f) => f.endsWith('.xlsx'));
const wb = XLSX.readFile(path.join(xlsxDir, xlsxFile));
const rows = XLSX.utils.sheet_to_json(wb.Sheets['DATOS 2'], { header: 1, defval: '' });

const excel = new Map();
for (const row of rows.slice(1)) {
  const name = String(row[0] || '').replace(/\.$/, '').trim();
  if (!name) continue;
  excel.set(name, {
    largo: Number(row[7]),
    alto: Number(row[8]),
    ancho: Number(row[9]),
  });
}

const cat = JSON.parse(
  fs.readFileSync(path.join(__dirname, '..', 'frontend', 'public', 'catalog_data.json'), 'utf-8'),
);

let ok = 0;
let fail = 0;
for (const [key, mod] of Object.entries(cat.modelos)) {
  const ex = excel.get(key) || excel.get(key.replace('+', '+'));
  if (!ex) continue;
  const extOk =
    Math.abs(mod.largo_aplicacion - ex.largo) < TOL &&
    Math.abs(mod.ancho_aplicacion - ex.ancho) < TOL &&
    Math.abs(mod.alto_aplicacion - ex.alto) < TOL;
  const inner = mod.cubicaje_peso?.interior_carga_2;
  const expect = {
    largo_cm: Math.round((ex.largo - 2 * WALL) * 100),
    ancho_cm: Math.round((ex.ancho - 2 * WALL) * 100),
    alto_cm: Math.round((ex.alto - 2 * WALL) * 100),
  };
  const intOk =
    inner &&
    inner.largo_cm === expect.largo_cm &&
    inner.ancho_cm === expect.ancho_cm &&
    inner.alto_cm === expect.alto_cm;
  if (extOk && intOk) {
    ok++;
  } else {
    fail++;
    console.log('FAIL', key, { extOk, intOk, mod: [mod.largo_aplicacion, mod.ancho_aplicacion, mod.alto_aplicacion], ex, inner, expect });
  }
}
console.log('Validados OK:', ok, 'FAIL:', fail);
process.exit(fail > 0 ? 1 : 0);
