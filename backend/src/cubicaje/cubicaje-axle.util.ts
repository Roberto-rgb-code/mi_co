import type { BultoColocado } from './cubicaje.service';
import { idealCargoCenterX, type ChassisAxleSpec } from './cubicaje-chassis';

export interface AxleLoadResult {
  ejeDelanteroKg: number;
  ejeTraseroKg: number;
  ejeDelanteroMaxKg: number;
  ejeTraseroMaxKg: number;
  ejeDelanteroOk: boolean;
  ejeTraseroOk: boolean;
  centroCargaX: number;
  centroIdealX: number;
}

function cargoCenterX(bultos: BultoColocado[]): number {
  let wSum = 0;
  let xSum = 0;
  for (const b of bultos) {
    const w = b.pesoKg ?? 0;
    if (w <= 0) continue;
    xSum += w * (b.x + b.largo / 2);
    wSum += w;
  }
  return wSum > 0 ? xSum / wSum : 0;
}

/** Reparto de peso en ejes delantero/trasero según posición longitudinal (ficha técnica). */
export function computeAxleLoads(bultos: BultoColocado[], spec: ChassisAxleSpec): AxleLoadResult {
  const xRear = spec.caM - spec.bocM;
  const xFront = xRear - spec.wheelbaseM;
  const tareFront = spec.taraChasisKg * 0.38;
  const tareRear = spec.taraChasisKg - tareFront;

  let front = tareFront;
  let rear = tareRear;

  for (const b of bultos) {
    const w = b.pesoKg ?? 0;
    if (w <= 0) continue;
    const cx = b.x + b.largo / 2;
    const dFromFront = Math.max(0, Math.min(spec.wheelbaseM, cx - xFront));
    rear += (w * dFromFront) / spec.wheelbaseM;
    front += w * (1 - dFromFront / spec.wheelbaseM);
  }

  return {
    ejeDelanteroKg: Math.round(front),
    ejeTraseroKg: Math.round(rear),
    ejeDelanteroMaxKg: spec.ejeDelanteroMaxKg,
    ejeTraseroMaxKg: spec.ejeTraseroMaxKg,
    ejeDelanteroOk: front <= spec.ejeDelanteroMaxKg,
    ejeTraseroOk: rear <= spec.ejeTraseroMaxKg,
    centroCargaX: Math.round(cargoCenterX(bultos) * 1000) / 1000,
    centroIdealX: Math.round(idealCargoCenterX(spec) * 1000) / 1000,
  };
}

/** Desplaza la carga en largo para acercar el centro de gravedad al punto ideal entre ejes. */
export function balanceLoadForAxles(
  items: BultoColocado[],
  contL: number,
  spec: ChassisAxleSpec,
): BultoColocado[] {
  if (items.length === 0) return items;

  const target = idealCargoCenterX(spec);
  const current = cargoCenterX(items);
  let shift = target - current;

  let minX = Math.min(...items.map((b) => b.x));
  let maxX = Math.max(...items.map((b) => b.x + b.largo));
  if (minX + shift < 0) shift = -minX;
  if (maxX + shift > contL) shift = contL - maxX;
  if (Math.abs(shift) < 0.005) return items;

  return items.map((b) => ({
    ...b,
    x: Math.round((b.x + shift) * 1000) / 1000,
  }));
}
