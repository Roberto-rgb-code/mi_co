import type { BultoColocado } from '../types/cubicaje';

export interface AxleLoad {
  x: number;
  kg: number;
  label: string;
}

const TARE_KG = 2800;

/** Reparte peso de carga + tara sobre 3 ejes (estilo EasyCargo). */
export function computeAxleLoads(
  bultos: BultoColocado[],
  largo: number,
  cabLen: number,
): AxleLoad[] {
  const axles: AxleLoad[] = [
    { x: cabLen * 0.15, kg: TARE_KG * 0.35, label: 'Delantero' },
    { x: largo * 0.55, kg: TARE_KG * 0.25, label: 'Central' },
    { x: largo * 0.88, kg: TARE_KG * 0.4, label: 'Trasero' },
  ];

  for (const b of bultos) {
    const cx = b.x + b.largo / 2;
    const w = b.pesoKg ?? 50;
    const dists = axles.map((a) => 1 / (Math.abs(cx - a.x) + 0.45));
    const sum = dists.reduce((s, d) => s + d, 0);
    dists.forEach((d, i) => {
      axles[i].kg += w * (d / sum);
    });
  }

  return axles;
}

export function calcMetrosVacios(bultos: BultoColocado[], largo: number): number {
  if (bultos.length === 0) return largo;
  const maxX = Math.max(...bultos.map((b) => b.x + b.largo));
  return Math.round(Math.max(0, largo - maxX) * 100) / 100;
}

export function calcVolumenUsado(bultos: BultoColocado[]): number {
  const v = bultos.reduce((s, b) => s + b.largo * b.ancho * b.alto, 0);
  return Math.round(v * 100) / 100;
}

export function formatKg(kg: number): string {
  return `${Math.round(kg).toLocaleString('es-MX')} kg`;
}
