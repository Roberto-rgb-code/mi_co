import type { BultoColocado } from './cubicaje.service';

export type FlatBultoLike = {
  id: string;
  label: string;
  tipo?: string;
  largo: number;
  ancho: number;
  alto: number;
  color: string;
  pesoKg?: number;
};

export type GridTipo = 'tarima' | 'tambo' | 'caja';

type Layout = { cols: number; rows: number; cellL: number; cellW: number; perLayer: number };

/** Espacio mínimo en largo (puerta trasera); ancho aprovecha casi todo el contenedor. */
const MARGEN_LARGO = 0.03;
const MARGEN_ANCHO = 0.01;
const MARGEN_ALTO = 0.02;

export function detectUniformGrid(flat: FlatBultoLike[]): GridTipo | null {
  if (flat.length === 0) return null;
  const ref = flat[0];
  const same = flat.every(
    (b) =>
      Math.abs(b.largo - ref.largo) < 0.002 &&
      Math.abs(b.ancho - ref.ancho) < 0.002 &&
      Math.abs(b.alto - ref.alto) < 0.002,
  );
  if (!same) return null;
  if (ref.tipo === 'tambo') return 'tambo';
  if (ref.tipo === 'tarima') return 'tarima';
  return 'caja';
}

function buildLayouts(tL: number, tW: number, usableL: number, usableW: number, allowRotate: boolean): Layout[] {
  const layouts: Layout[] = [];
  const tryLayout = (cellL: number, cellW: number) => {
    const cols = Math.floor(usableW / cellW);
    const rows = Math.floor(usableL / cellL);
    if (cols > 0 && rows > 0) {
      layouts.push({ cols, rows, cellL, cellW, perLayer: cols * rows });
    }
  };
  tryLayout(tL, tW);
  if (allowRotate && Math.abs(tL - tW) > 0.001) tryLayout(tW, tL);
  return layouts;
}

/** Prioriza llenar el piso (menos capas), luego más bultos por capa, luego menor huella. */
function pickBestLayout(layouts: Layout[], count: number, maxLayers: number): Layout | null {
  let best: { layout: Layout; score: number } | null = null;

  for (const layout of layouts) {
    const layers = Math.ceil(count / layout.perLayer);
    if (layers > maxLayers) continue;

    const lastLayerCount = count % layout.perLayer || layout.perLayer;
    const rowsLast = Math.ceil(lastLayerCount / layout.cols);
    const totalRows = layers === 1 ? rowsLast : (layers - 1) * layout.rows + rowsLast;
    const lengthUsed = totalRows * layout.cellL;
    const widthUsed = layout.cols * layout.cellW;
    const footprint = lengthUsed * widthUsed;

    const score = layers * 1_000_000 - layout.perLayer * 10_000 + footprint;
    if (!best || score < best.score) best = { layout, score };
  }

  return best?.layout ?? null;
}

function centerLoad(
  items: BultoColocado[],
  contL: number,
  contW: number,
): BultoColocado[] {
  if (items.length === 0) return items;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const b of items) {
    minX = Math.min(minX, b.x);
    maxX = Math.max(maxX, b.x + b.largo);
    minZ = Math.min(minZ, b.z);
    maxZ = Math.max(maxZ, b.z + b.ancho);
  }

  const loadCx = (minX + maxX) / 2;
  const loadCz = (minZ + maxZ) / 2;
  let shiftX = contL / 2 - loadCx;
  let shiftZ = contW / 2 - loadCz;

  if (minX + shiftX < 0) shiftX -= minX + shiftX;
  if (maxX + shiftX > contL) shiftX -= maxX + shiftX - contL;
  if (minZ + shiftZ < 0) shiftZ -= minZ + shiftZ;
  if (maxZ + shiftZ > contW) shiftZ -= maxZ + shiftZ - contW;

  if (Math.abs(shiftX) < 0.001 && Math.abs(shiftZ) < 0.001) return items;

  return items.map((b) => ({
    ...b,
    x: Math.round((b.x + shiftX) * 1000) / 1000,
    z: Math.round((b.z + shiftZ) * 1000) / 1000,
  }));
}

function assignFilas(bultos: BultoColocado[], contLargo: number): BultoColocado[] {
  if (bultos.length === 0) return bultos;
  const slice = contLargo / 4;
  return bultos.map((b) => ({
    ...b,
    fila: Math.min(4, Math.max(1, Math.floor(b.x / slice) + 1)),
  }));
}

export function packUniformGrid(
  contL: number,
  contW: number,
  contH: number,
  flat: FlatBultoLike[],
  tipo: GridTipo,
): BultoColocado[] {
  const sorted = [...flat].sort((a, b) => (b.pesoKg ?? 0) - (a.pesoKg ?? 0));
  const proto = sorted[0];
  const count = sorted.length;
  const tH = proto.alto;
  let tL: number;
  let tW: number;
  if (tipo === 'tambo') {
    const d = Math.max(proto.largo, proto.ancho);
    tL = d;
    tW = d;
  } else {
    tL = proto.largo;
    tW = proto.ancho;
  }

  const usableL = contL - MARGEN_LARGO;
  const usableW = tipo === 'tarima' ? contW : contW - 2 * MARGEN_ANCHO;
  const maxLayers = Math.floor((contH - MARGEN_ALTO) / tH);
  if (maxLayers < 1) return [];

  const layouts = buildLayouts(tL, tW, usableL, usableW, tipo !== 'tambo');
  const layout = pickBestLayout(layouts, count, maxLayers);
  if (!layout) return [];

  const maxTotal = layout.perLayer * maxLayers;
  const toPlace = Math.min(count, maxTotal);
  const result: BultoColocado[] = [];
  const originL = MARGEN_LARGO / 2;
  const originW = tipo === 'tarima' ? 0 : MARGEN_ANCHO;

  type Slot = { row: number; col: number; layer: number };
  const slots: Slot[] = [];
  outer: for (let layer = 0; layer < maxLayers; layer++) {
    for (let row = 0; row < layout.rows; row++) {
      for (let col = 0; col < layout.cols; col++) {
        slots.push({ row, col, layer });
        if (slots.length >= toPlace) break outer;
      }
    }
  }

  for (let i = 0; i < toPlace; i++) {
    const src = sorted[i];
    const { row, col, layer } = slots[i];
    const placedL = tipo === 'tambo' ? tL : layout.cellL;
    const placedW = tipo === 'tambo' ? tW : layout.cellW;
    result.push({
      id: src.id,
      label: src.label,
      tipo: src.tipo,
      x: originL + row * layout.cellL,
      y: layer * tH,
      z: originW + col * layout.cellW,
      largo: placedL,
      ancho: placedW,
      alto: tH,
      color: src.color,
      pesoKg: src.pesoKg,
      fila: row + 1,
      colocado: true,
    });
  }

  return assignFilas(centerLoad(result, contL, contW), contL);
}
