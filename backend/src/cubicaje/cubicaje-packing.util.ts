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

const MARGEN = 0.05;

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

/** Elige la rejilla que minimiza espacio vacío en largo para la cantidad dada. */
function pickBestLayout(layouts: Layout[], count: number, maxLayers: number): Layout | null {
  let best: { layout: Layout; score: number } | null = null;

  for (const layout of layouts) {
    const layers = Math.ceil(count / layout.perLayer);
    if (layers > maxLayers) continue;

    const lastLayer = count % layout.perLayer || layout.perLayer;
    const rowsLast = Math.ceil(lastLayer / layout.cols);
    const totalRows = layers === 1 ? rowsLast : (layers - 1) * layout.rows + rowsLast;
    const lengthUsed = totalRows * layout.cellL;
    const widthUsed = layout.cols * layout.cellW;
    const footprint = lengthUsed * widthUsed;
    const wasted = layout.rows * layout.cols * layers - count;

    const score = footprint + wasted * 0.01;
    if (!best || score < best.score) best = { layout, score };
  }

  return best?.layout ?? null;
}

export function packUniformGrid(
  contL: number,
  contW: number,
  contH: number,
  flat: FlatBultoLike[],
  tipo: GridTipo,
): BultoColocado[] {
  const proto = flat[0];
  const count = flat.length;
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

  const usableL = contL - 2 * MARGEN;
  const usableW = contW - 2 * MARGEN;
  const maxLayers = Math.floor((contH - 2 * MARGEN) / tH);
  if (maxLayers < 1) return [];

  const layouts = buildLayouts(tL, tW, usableL, usableW, tipo !== 'tambo');
  const layout = pickBestLayout(layouts, count, maxLayers);
  if (!layout) return [];

  const maxTotal = layout.perLayer * maxLayers;
  const toPlace = Math.min(count, maxTotal);
  const result: BultoColocado[] = [];

  for (let i = 0; i < toPlace; i++) {
    const src = flat[i];
    const layer = Math.floor(i / layout.perLayer);
    const idx = i % layout.perLayer;
    const row = Math.floor(idx / layout.cols);
    const col = idx % layout.cols;
    const placedL = tipo === 'tambo' ? tL : layout.cellL;
    const placedW = tipo === 'tambo' ? tW : layout.cellW;
    result.push({
      id: src.id,
      label: src.label,
      tipo: src.tipo,
      x: MARGEN + row * layout.cellL,
      y: layer * tH,
      z: MARGEN + col * layout.cellW,
      largo: placedL,
      ancho: placedW,
      alto: tH,
      color: src.color,
      pesoKg: src.pesoKg,
      fila: row + 1,
      colocado: true,
    });
  }
  return result;
}
