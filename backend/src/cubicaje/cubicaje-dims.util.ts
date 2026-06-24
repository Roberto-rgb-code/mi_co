/** Espesor estándar panel carrocería seca ISUZU (~5 cm por lado). */
export const WALL_M = { largo: 0.05, ancho: 0.05, alto: 0.05 };

export type DimsM = { largo: number; ancho: number; alto: number };

export type ModeloDimsLike = {
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

/** Dimensiones exteriores de la aplicación (m) — hoja DATOS 2 / cotización. */
export function resolveContenedorExterior(mod?: ModeloDimsLike): DimsM {
  return {
    largo: mod?.largo_aplicacion ?? 6,
    ancho: mod?.ancho_aplicacion ?? 2.2,
    alto: mod?.alto_aplicacion ?? 2.2,
  };
}

/** Dimensiones interiores útiles para cubicaje (m) = exterior − 2×espesor pared. */
export function resolveContenedorInterior(mod?: ModeloDimsLike): DimsM {
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

  // Solo confiar en catálogo si es coherente con exterior (evita datos viejos erróneos).
  const minL = derived.largo * 0.85;
  const minW = derived.ancho * 0.85;
  if (fromCatalog.largo >= minL && fromCatalog.ancho >= minW) {
    return {
      largo: round3(fromCatalog.largo),
      ancho: round3(fromCatalog.ancho),
      alto: round3(fromCatalog.alto),
    };
  }
  return derived;
}

export function interiorCmFromExteriorM(ext: DimsM): { largo_cm: number; ancho_cm: number; alto_cm: number } {
  const inner = {
    largo: Math.max(0.5, ext.largo - 2 * WALL_M.largo),
    ancho: Math.max(0.5, ext.ancho - 2 * WALL_M.ancho),
    alto: Math.max(0.5, ext.alto - 2 * WALL_M.alto),
  };
  return {
    largo_cm: Math.round(inner.largo * 100),
    ancho_cm: Math.round(inner.ancho * 100),
    alto_cm: Math.round(inner.alto * 100),
  };
}
