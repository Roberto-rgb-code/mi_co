import type { CubicajeAsistenteItem, CubicajeAsistenteTipo } from './cubicaje-assistant.service';

/** Catálogo de medidas estándar (metros). */
export const STANDARD_SPECS: Record<
  CubicajeAsistenteTipo,
  { largo: number; ancho: number; alto: number; pesoKg: number }
> = {
  pequena: { largo: 0.3, ancho: 0.2, alto: 0.15, pesoKg: 15 },
  mediana: { largo: 0.5, ancho: 0.4, alto: 0.3, pesoKg: 35 },
  grande: { largo: 0.75, ancho: 0.5, alto: 0.6, pesoKg: 80 },
  tarima: { largo: 1.2, ancho: 1.0, alto: 1.5, pesoKg: 700 },
  tambo: { largo: 0.585, ancho: 0.585, alto: 0.88, pesoKg: 200 },
};

/** Tambos industriales comunes por litros → Ø m, alto m. */
const DRUM_LITERS: Record<number, { d: number; h: number }> = {
  50: { d: 0.39, h: 0.75 },
  100: { d: 0.49, h: 0.88 },
  200: { d: 0.585, h: 0.88 },
  208: { d: 0.585, h: 0.88 },
  220: { d: 0.585, h: 0.95 },
};

/** Convierte valor a metros si parece cm/mm o número mal escalado. */
export function toMeters(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return value;
  if (value >= 0.05 && value <= 3) return value;
  if (value >= 100 && value <= 999) return value / 1000;
  if (value >= 10 && value < 100) return value / 100;
  if (value >= 1000) return value / 100;
  return value;
}

export function normalizeItemDims(item: CubicajeAsistenteItem): CubicajeAsistenteItem {
  const spec = STANDARD_SPECS[item.tipo];
  const out = { ...item };

  if (out.largo != null) out.largo = toMeters(out.largo);
  if (out.ancho != null) out.ancho = toMeters(out.ancho);
  if (out.alto != null) out.alto = toMeters(out.alto);

  if (item.tipo === 'tambo') {
    const d = out.largo ?? out.ancho ?? spec.largo;
    out.largo = d;
    out.ancho = d;
  }

  if (out.largo == null) out.largo = spec.largo;
  if (out.ancho == null) out.ancho = spec.ancho;
  if (out.alto == null) out.alto = spec.alto;

  out.largo = round3(clampDim(out.largo));
  out.ancho = round3(clampDim(out.ancho));
  out.alto = round3(clampDim(out.alto));

  if (item.tipo === 'tambo') {
    out.ancho = out.largo;
  }

  return out;
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function clampDim(n: number): number {
  return Math.min(15, Math.max(0.05, n));
}

/** Extrae pistas del texto del usuario para corregir/completar medidas. */
export function enrichItemsFromUserText(
  items: CubicajeAsistenteItem[],
  userText: string,
): CubicajeAsistenteItem[] {
  const text = userText.toLowerCase();

  const litersMatch = text.match(/(\d+)\s*(?:l|lt|lts|litros?)/);
  const liters = litersMatch ? parseInt(litersMatch[1], 10) : null;
  const drumSpec = liters != null ? DRUM_LITERS[liters] ?? DRUM_LITERS[200] : null;

  const qtyMatch = text.match(/(\d+)\s*(?:tambos?|bidones?|barriles?|tarimas?|pallets?|cajas?|bolsas?|sacos?)/);
  const pesoUnitMatch =
    text.match(/(?:cada uno|por (?:uno|unidad|tambo|tarima|caja|bolsa|saco)|\/u)\D*(\d+)\s*kg/) ||
    text.match(/(\d+)\s*kg\s*(?:cada|por|\/)/);
  const pesoTotalMatch = text.match(/(?:peso total(?:\s+de)?|total(?:\s+de)?)\s+(\d+)/);
  const tonMatch = text.match(/(\d+(?:[.,]\d+)?)\s*toneladas?/);
  const apilar = /apilar|una arriba|encima|en capas|apilad/.test(text);
  const isBolsa = /bolsas?|sacos?|hielo/.test(text);

  return items.map((raw) => {
    let item = normalizeItemDims(raw);

    if (item.tipo === 'tambo' && drumSpec) {
      item = {
        ...item,
        largo: drumSpec.d,
        ancho: drumSpec.d,
        alto: drumSpec.h,
      };
    }

    const dimTriple =
      text.match(/(\d+[.,]?\d*)\s*[×x]\s*(\d+[.,]?\d*)\s*[×x]\s*(\d+[.,]?\d*)\s*(?:cm|m)?/) ||
      text.match(/(\d+[.,]?\d*)\s*[×x]\s*(\d+[.,]?\d*)\s*[×x]\s*(\d+[.,]?\d*)/);
    if (dimTriple && item.tipo !== 'tambo') {
      const a = parseFloat(dimTriple[1].replace(',', '.'));
      const b = parseFloat(dimTriple[2].replace(',', '.'));
      const c = parseFloat(dimTriple[3].replace(',', '.'));
      const isCm = text.includes('cm') || Math.max(a, b, c) > 3;
      const scale = isCm ? 0.01 : 1;
      const dims = [a, b, c].map((v) => round3(v * scale)).sort((x, y) => y - x);
      item.largo = dims[0];
      item.ancho = dims[1];
      item.alto = dims[2];
    } else if (isBolsa && item.tipo === 'pequena') {
      item.largo = 0.35;
      item.ancho = 0.25;
      item.alto = apilar ? 0.08 : 0.15;
    }

    if (pesoUnitMatch) {
      item.pesoKg = parseInt(pesoUnitMatch[1], 10);
    } else if (pesoTotalMatch && item.cantidad > 0) {
      item.pesoKg = Math.round(parseInt(pesoTotalMatch[1], 10) / item.cantidad);
    }

    if (tonMatch) {
      const tons = parseFloat(tonMatch[1].replace(',', '.'));
      const totalKg = Math.round(tons * 1000);
      if (item.pesoKg != null && item.pesoKg > 0) {
        item.cantidad = Math.max(item.cantidad, Math.round(totalKg / item.pesoKg));
      } else if (pesoUnitMatch) {
        const unitKg = parseInt(pesoUnitMatch[1], 10);
        item.pesoKg = unitKg;
        item.cantidad = Math.max(item.cantidad, Math.round(totalKg / unitKg));
      }
    }

    if (qtyMatch && items.length === 1) {
      const q = parseInt(qtyMatch[1], 10);
      if (q > 0) item.cantidad = q;
    }

    if (item.pesoKg == null) item.pesoKg = STANDARD_SPECS[item.tipo].pesoKg;

    return item;
  });
}

export function formatItemDims(item: CubicajeAsistenteItem): string {
  if (item.tipo === 'tambo') {
    const d = item.largo ?? STANDARD_SPECS.tambo.largo;
    const h = item.alto ?? STANDARD_SPECS.tambo.alto;
    return `Ø${d}×${h} m`;
  }
  return `${item.largo}×${item.ancho}×${item.alto} m`;
}
