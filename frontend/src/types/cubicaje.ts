export type TipoBultoId = 'pequena' | 'mediana' | 'grande' | 'tarima' | 'tambo' | 'custom';

export type BultoForma = 'caja' | 'cilindro';

export interface TipoBultoPreset {
  id: TipoBultoId;
  label: string;
  largo: number;
  ancho: number;
  alto: number;
  color: string;
  pesoKg: number;
  forma: BultoForma;
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
    forma: 'caja',
  },
  mediana: {
    id: 'mediana',
    label: 'Caja mediana',
    largo: 0.5,
    ancho: 0.4,
    alto: 0.3,
    color: '#3b82f6',
    pesoKg: 35,
    forma: 'caja',
  },
  grande: {
    id: 'grande',
    label: 'Caja grande',
    largo: 0.75,
    ancho: 0.5,
    alto: 0.6,
    color: '#f97316',
    pesoKg: 80,
    forma: 'caja',
  },
  tarima: {
    id: 'tarima',
    label: 'Tarima',
    largo: 1.2,
    ancho: 1.0,
    alto: 1.5,
    color: '#c8102e',
    pesoKg: 700,
    forma: 'caja',
  },
  tambo: {
    id: 'tambo',
    label: 'Tambo',
    largo: 0.585,
    ancho: 0.585,
    alto: 0.88,
    color: '#0891b2',
    pesoKg: 200,
    forma: 'cilindro',
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
  modeloSugerido?: string;
  sugerencia?: string;
}

export type CameraPreset = 'iso' | 'side' | 'top';

export const CAMERA_PRESETS: Record<
  CameraPreset,
  { position: [number, number, number]; label: string }
> = {
  side: { position: [0.02, 0.28, 2.4], label: 'Vista lateral' },
  top: { position: [0.02, 3.2, 0.05], label: 'Vista superior' },
  iso: { position: [1.6, 0.85, 1.8], label: '3/4' },
};

export interface InventarioCounts {
  pequena: number;
  mediana: number;
  grande: number;
  tarima: number;
  tambo: number;
}

export const INVENTARIO_TIPOS = ['pequena', 'mediana', 'grande', 'tarima', 'tambo'] as const;
export type InventarioTipoId = (typeof INVENTARIO_TIPOS)[number];

export interface BultoDims {
  largo: number;
  ancho: number;
  alto: number;
}

export type InventarioDims = Record<InventarioTipoId, BultoDims>;

export const DEFAULT_INVENTARIO_DIMS: InventarioDims = {
  pequena: { largo: TIPOS_BULTO.pequena.largo, ancho: TIPOS_BULTO.pequena.ancho, alto: TIPOS_BULTO.pequena.alto },
  mediana: { largo: TIPOS_BULTO.mediana.largo, ancho: TIPOS_BULTO.mediana.ancho, alto: TIPOS_BULTO.mediana.alto },
  grande: { largo: TIPOS_BULTO.grande.largo, ancho: TIPOS_BULTO.grande.ancho, alto: TIPOS_BULTO.grande.alto },
  tarima: { largo: TIPOS_BULTO.tarima.largo, ancho: TIPOS_BULTO.tarima.ancho, alto: TIPOS_BULTO.tarima.alto },
  tambo: { largo: TIPOS_BULTO.tambo.largo, ancho: TIPOS_BULTO.tambo.ancho, alto: TIPOS_BULTO.tambo.alto },
};

export interface InventarioItemConfig {
  pesoKg: number;
  /** Nombre en etiqueta 3D; vacío = nombre del preset */
  etiqueta: string;
}

export type InventarioConfig = Record<InventarioTipoId, InventarioItemConfig>;

export const DEFAULT_INVENTARIO_CONFIG: InventarioConfig = Object.fromEntries(
  INVENTARIO_TIPOS.map((tipo) => [tipo, { pesoKg: TIPOS_BULTO[tipo].pesoKg, etiqueta: '' }]),
) as InventarioConfig;

export function resolveInventarioLabel(
  tipo: InventarioTipoId,
  config: InventarioConfig,
  productoLabel?: string,
): string {
  const custom = config[tipo].etiqueta.trim();
  if (custom) return custom;
  if (tipo === 'tarima' && productoLabel) return `Tarima (${productoLabel})`;
  return TIPOS_BULTO[tipo].label;
}

export function bultoVolume(dims: BultoDims, forma: BultoForma = 'caja'): number {
  if (forma === 'cilindro') {
    const d = dims.largo;
    return Math.PI * (d / 2) ** 2 * dims.alto;
  }
  return dims.largo * dims.ancho * dims.alto;
}

export function inventarioToBultos(
  counts: InventarioCounts,
  dims: InventarioDims = DEFAULT_INVENTARIO_DIMS,
  config: InventarioConfig = DEFAULT_INVENTARIO_CONFIG,
  productoLabel?: string,
): BultoInput[] {
  const out: BultoInput[] = [];
  INVENTARIO_TIPOS.forEach((tipo) => {
    if (counts[tipo] <= 0) return;
    const p = TIPOS_BULTO[tipo];
    const d = dims[tipo];
    const c = config[tipo];
    out.push({
      id: tipo,
      label: resolveInventarioLabel(tipo, config, productoLabel),
      tipo,
      largo: d.largo,
      ancho: d.ancho,
      alto: d.alto,
      cantidad: counts[tipo],
      color: p.color,
      pesoKg: c.pesoKg,
    });
  });
  return out;
}

export interface CubicajeAsistenteItem {
  tipo: InventarioTipoId;
  cantidad: number;
  largo?: number;
  ancho?: number;
  alto?: number;
  pesoKg?: number;
  etiqueta?: string;
}

export interface CubicajeAsistenteResponse {
  reply: string;
  aplicar: boolean;
  autoCalcular: boolean;
  modelo?: string;
  utilizacionPct?: number;
  pesoTotalKg?: number;
  items: CubicajeAsistenteItem[];
}

export function applyAsistenteItems(items: CubicajeAsistenteItem[]): {
  inventario: InventarioCounts;
  dims: InventarioDims;
  config: InventarioConfig;
} {
  const inventario: InventarioCounts = {
    pequena: 0,
    mediana: 0,
    grande: 0,
    tarima: 0,
    tambo: 0,
  };
  const dims: InventarioDims = { ...DEFAULT_INVENTARIO_DIMS };
  const config: InventarioConfig = {} as InventarioConfig;
  for (const t of INVENTARIO_TIPOS) {
    config[t] = { ...DEFAULT_INVENTARIO_CONFIG[t] };
  }

  for (const item of items) {
    if (!INVENTARIO_TIPOS.includes(item.tipo) || item.cantidad <= 0) continue;
    inventario[item.tipo] = item.cantidad;
    if (item.largo != null) dims[item.tipo].largo = item.largo;
    if (item.ancho != null) dims[item.tipo].ancho = item.ancho;
    if (item.alto != null) dims[item.tipo].alto = item.alto;
    if (item.tipo === 'tambo' && item.largo != null && item.ancho == null) {
      dims.tambo.ancho = item.largo;
    }
    if (item.pesoKg != null) config[item.tipo].pesoKg = item.pesoKg;
    if (item.etiqueta != null) config[item.tipo].etiqueta = item.etiqueta;
  }

  return { inventario, dims, config };
}
