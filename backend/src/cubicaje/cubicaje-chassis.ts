/** Datos de ficha técnica ISUZU (Distribucion_carga) para distribución de peso. */
export interface ChassisAxleSpec {
  pvbKg: number;
  ejeDelanteroMaxKg: number;
  ejeTraseroMaxKg: number;
  taraChasisKg: number;
  /** Distancia entre ejes (m). */
  wheelbaseM: number;
  /** Respaldo cabina → inicio de caja (m). */
  bocM: number;
  /** Respaldo cabina → eje trasero (m). */
  caM: number;
  /** Eje trasero doble / tandem. */
  tandem?: boolean;
}

type ModeloDims = {
  distancia_entre_ejes?: number;
  pvb?: number;
  capacidad_carga?: string;
  modelo?: string;
};

/** Familias según fichas técnicas PDF. */
const FICHA_BY_FAMILY: Record<string, Omit<ChassisAxleSpec, 'wheelbaseM' | 'pvbKg'>> = {
  'ELF 100': {
    ejeDelanteroMaxKg: 1900,
    ejeTraseroMaxKg: 2700,
    taraChasisKg: 2025,
    bocM: 0.258,
    caM: 2.022,
  },
  'ELF 200': {
    ejeDelanteroMaxKg: 2000,
    ejeTraseroMaxKg: 3000,
    taraChasisKg: 2025,
    bocM: 0.258,
    caM: 2.022,
  },
  'ELF 300E': {
    ejeDelanteroMaxKg: 2500,
    ejeTraseroMaxKg: 4000,
    taraChasisKg: 2175,
    bocM: 0.258,
    caM: 2.022,
  },
  'ELF 300H': {
    ejeDelanteroMaxKg: 2500,
    ejeTraseroMaxKg: 4000,
    taraChasisKg: 2255,
    bocM: 0.258,
    caM: 2.892,
  },
  'ELF 350': {
    ejeDelanteroMaxKg: 2600,
    ejeTraseroMaxKg: 4500,
    taraChasisKg: 2500,
    bocM: 0.111,
    caM: 2.192,
  },
  'ELF 400': {
    ejeDelanteroMaxKg: 2700,
    ejeTraseroMaxKg: 5000,
    taraChasisKg: 2750,
    bocM: 0.111,
    caM: 2.192,
  },
  'ELF 500': {
    ejeDelanteroMaxKg: 3000,
    ejeTraseroMaxKg: 5800,
    taraChasisKg: 2950,
    bocM: 0.111,
    caM: 2.192,
  },
  'ELF 600': {
    ejeDelanteroMaxKg: 3100,
    ejeTraseroMaxKg: 6600,
    taraChasisKg: 3000,
    bocM: 0.111,
    caM: 2.792,
  },
  'FORWARD 800': {
    ejeDelanteroMaxKg: 3600,
    ejeTraseroMaxKg: 7700,
    taraChasisKg: 3700,
    bocM: 0.246,
    caM: 3.504,
  },
  'FORWARD 1100': {
    ejeDelanteroMaxKg: 6300,
    ejeTraseroMaxKg: 11000,
    taraChasisKg: 5900,
    bocM: 0.106,
    caM: 4.024,
  },
  'FORWARD 1400': {
    ejeDelanteroMaxKg: 6300,
    ejeTraseroMaxKg: 13000,
    taraChasisKg: 5900,
    bocM: 0.106,
    caM: 4.024,
  },
  'FORWARD 1800': {
    ejeDelanteroMaxKg: 6300,
    ejeTraseroMaxKg: 19500,
    taraChasisKg: 7245,
    bocM: 0.106,
    caM: 5.724,
    tandem: true,
  },
  'FORWARD 2000': {
    ejeDelanteroMaxKg: 6300,
    ejeTraseroMaxKg: 21000,
    taraChasisKg: 7620,
    bocM: 0.106,
    caM: 5.724,
    tandem: true,
  },
};

function inferFamily(modelKey: string, dims?: ModeloDims): string {
  const k = modelKey.toUpperCase().replace(/\s+/g, ' ');
  const wb = dims?.distancia_entre_ejes ?? 0;

  if (k.includes('ELF 100') || k.includes('ELF100')) return 'ELF 100';
  if (k.includes('ELF 200') || k.includes('ELF200')) return 'ELF 200';
  if (k.includes('ELF 300') || k.includes('ELF300')) return wb >= 3.2 ? 'ELF 300H' : 'ELF 300E';
  if (k.includes('ELF 350') || k.includes('ELF350')) return 'ELF 350';
  if (k.includes('ELF 400') || k.includes('ELF400')) return 'ELF 400';
  if (k.includes('ELF 500') || k.includes('ELF500')) return 'ELF 500';
  if (k.includes('ELF 600') || k.includes('ELF600')) return 'ELF 600';
  if (k.includes('FORWARD 800') || k.includes('FORWARD800')) return 'FORWARD 800';
  if (k.includes('FORWARD 1100') || k.includes('FORWARD1100')) return 'FORWARD 1100';
  if (k.includes('FORWARD 1400') || k.includes('FORWARD1400')) return 'FORWARD 1400';
  if (k.includes('FORWARD 2000') || k.includes('FORWARD2000')) return 'FORWARD 2000';
  if (k.includes('FORWARD 1800') || k.includes('FORWARD1800')) return 'FORWARD 1800';
  if (k.includes('FORWARD')) return 'FORWARD 1100';
  if (k.includes('ELF')) return 'ELF 500';
  return 'ELF 200';
}

export function resolveChassisSpec(modelKey: string, dims?: ModeloDims): ChassisAxleSpec {
  const family = inferFamily(modelKey, dims);
  const base = FICHA_BY_FAMILY[family] ?? FICHA_BY_FAMILY['ELF 200'];
  const wheelbaseM = dims?.distancia_entre_ejes ?? (family.includes('300H') ? 3.345 : 2.475);
  const pvbKg = dims?.pvb != null ? dims.pvb * 1000 : base.taraChasisKg + 1800;

  if (wheelbaseM >= 4.4 && family.startsWith('ELF')) {
    return {
      ...base,
      wheelbaseM,
      pvbKg,
      caM: base.caM + (wheelbaseM - 2.765),
    };
  }
  if (wheelbaseM >= 5.2 && family.startsWith('FORWARD')) {
    return { ...base, wheelbaseM, pvbKg, caM: base.caM + (wheelbaseM - 4.65) };
  }

  return { ...base, wheelbaseM, pvbKg };
}

/** Posición del eje trasero dentro de la caja de carga (m desde el frente de la caja). */
export function rearAxleInCargo(spec: ChassisAxleSpec): number {
  return spec.caM - spec.bocM;
}

/** Centro ideal de la carga para reparto uniforme entre ejes (ficha: carga distribuida uniformemente). */
export function idealCargoCenterX(spec: ChassisAxleSpec): number {
  const xRear = rearAxleInCargo(spec);
  const xFront = xRear - spec.wheelbaseM;
  return (xFront + xRear) / 2;
}
