/** Espesor panel carrocería seca (~5 cm/lado) — alineado con backend cubicaje-dims.util.ts */
const WALL_M = { largo: 0.05, ancho: 0.05, alto: 0.05 };

export type DimsM = { largo: number; ancho: number; alto: number };

export type ModeloCatalogLike = {
  largo_aplicacion?: number;
  ancho_aplicacion?: number;
  alto_aplicacion?: number;
  cubicaje_peso?: {
    interior_carga_2?: { largo_cm?: number | null; ancho_cm?: number | null; alto_cm?: number | null };
  };
};

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

export function resolveContenedorExterior(mod?: ModeloCatalogLike): DimsM {
  return {
    largo: mod?.largo_aplicacion ?? 6,
    ancho: mod?.ancho_aplicacion ?? 2.2,
    alto: mod?.alto_aplicacion ?? 2.2,
  };
}

export function formatDimsLine(d: DimsM, tipo: 'interior' | 'exterior'): string {
  const suf = tipo === 'interior' ? 'interior' : 'exterior';
  return (
    `Largo ${suf} ${(d.largo * 100).toFixed(0)} cm · ` +
    `Ancho ${suf} ${(d.ancho * 100).toFixed(0)} cm · ` +
    `Alto ${suf} ${(d.alto * 100).toFixed(0)} cm`
  );
}

export function resolveContenedorInterior(mod?: ModeloCatalogLike): DimsM {
  const ext = resolveContenedorExterior(mod);
  const derived: DimsM = {
    largo: round3(Math.max(0.5, ext.largo - 2 * WALL_M.largo)),
    ancho: round3(Math.max(0.5, ext.ancho - 2 * WALL_M.ancho)),
    alto: round3(Math.max(0.5, ext.alto - 2 * WALL_M.alto)),
  };
  const cp = mod?.cubicaje_peso?.interior_carga_2;
  if (!cp?.largo_cm || !cp?.ancho_cm) return derived;
  const fromCatalog: DimsM = {
    largo: cp.largo_cm / 100,
    ancho: cp.ancho_cm / 100,
    alto: cp.alto_cm != null ? cp.alto_cm / 100 : derived.alto,
  };
  if (fromCatalog.largo >= derived.largo * 0.85 && fromCatalog.ancho >= derived.ancho * 0.85) {
    return {
      largo: round3(fromCatalog.largo),
      ancho: round3(fromCatalog.ancho),
      alto: round3(fromCatalog.alto),
    };
  }
  return derived;
}
