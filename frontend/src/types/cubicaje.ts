export type TipoBultoId = 'pequena' | 'mediana' | 'grande' | 'tarima' | 'custom';

export interface TipoBultoPreset {
  id: TipoBultoId;
  label: string;
  largo: number;
  ancho: number;
  alto: number;
  color: string;
  pesoKg: number;
}

/** Presets inspirados en CLOA (Google-Gemini3Pro-CargoLoadOptimiser) + tarima estándar MX. */
export const TIPOS_BULTO: Record<Exclude<TipoBultoId, 'custom'>, TipoBultoPreset> = {
  pequena: {
    id: 'pequena',
    label: 'Caja pequeña',
    largo: 0.3,
    ancho: 0.2,
    alto: 0.15,
    color: '#22c55e',
    pesoKg: 15,
  },
  mediana: {
    id: 'mediana',
    label: 'Caja mediana',
    largo: 0.5,
    ancho: 0.4,
    alto: 0.3,
    color: '#3b82f6',
    pesoKg: 35,
  },
  grande: {
    id: 'grande',
    label: 'Caja grande',
    largo: 0.75,
    ancho: 0.5,
    alto: 0.6,
    color: '#f97316',
    pesoKg: 80,
  },
  tarima: {
    id: 'tarima',
    label: 'Tarima',
    largo: 1.2,
    ancho: 1.0,
    alto: 1.5,
    color: '#c8102e',
    pesoKg: 700,
  },
};

export interface BultoInput {
  id?: string;
  label?: string;
  tipo?: TipoBultoId;
  largo: number;
  ancho: number;
  alto: number;
  cantidad: number;
  color?: string;
  pesoKg?: number;
}

export interface CubicajeInput {
  modelo: string;
  bultos: BultoInput[];
  pesoEstimadoKg?: number;
}

export interface BultoColocado {
  id: string;
  label: string;
  tipo?: TipoBultoId;
  x: number;
  y: number;
  z: number;
  largo: number;
  ancho: number;
  alto: number;
  color: string;
  pesoKg?: number;
  fila: number;
  colocado: boolean;
}

export interface BultoNoColocado {
  id: string;
  label: string;
  tipo?: TipoBultoId;
  color: string;
  pesoKg?: number;
}

export interface CubicajeResult {
  modelo: string;
  contenedor: { largo: number; ancho: number; alto: number };
  bultos: BultoColocado[];
  noColocados: BultoNoColocado[];
  totalSolicitados: number;
  totalColocados: number;
  noCabe: number;
  cabenTodos: boolean;
  utilizacionVolumen: number;
  pesoEstimadoKg?: number;
  pesoColocadoKg: number;
  pesoMaxKg?: number;
  pesoOk: boolean;
  filas: number;
  mensaje: string;
}

export type CameraPreset = 'iso' | 'side' | 'top';

export const CAMERA_PRESETS: Record<
  CameraPreset,
  { position: [number, number, number]; label: string }
> = {
  side: { position: [0.02, 0.28, 2.4], label: 'Vista lateral' },
  top: { position: [0.02, 3.2, 0.05], label: 'Vista superior' },
  iso: { position: [1.6, 0.85, 1.8], label: 'Isométrica' },
};

export interface InventarioCounts {
  pequena: number;
  mediana: number;
  grande: number;
  tarima: number;
}

export function inventarioToBultos(
  counts: InventarioCounts,
  tarimaDims?: { largo: number; ancho: number; alto: number },
  productoLabel?: string,
): BultoInput[] {
  const out: BultoInput[] = [];
  (['pequena', 'mediana', 'grande'] as const).forEach((tipo) => {
    if (counts[tipo] > 0) {
      const p = TIPOS_BULTO[tipo];
      out.push({
        id: tipo,
        label: p.label,
        tipo,
        largo: p.largo,
        ancho: p.ancho,
        alto: p.alto,
        cantidad: counts[tipo],
        color: p.color,
        pesoKg: p.pesoKg,
      });
    }
  });
  if (counts.tarima > 0) {
    const t = TIPOS_BULTO.tarima;
    out.push({
      id: 'tarima',
      label: productoLabel ? `Tarima (${productoLabel})` : t.label,
      tipo: 'tarima',
      largo: tarimaDims?.largo ?? t.largo,
      ancho: tarimaDims?.ancho ?? t.ancho,
      alto: tarimaDims?.alto ?? t.alto,
      cantidad: counts.tarima,
      color: t.color,
      pesoKg: t.pesoKg,
    });
  }
  return out;
}
