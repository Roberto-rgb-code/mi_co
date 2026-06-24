import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Container, Item, PackingService } from '3d-bin-packing-ts';
import { detectUniformGrid, packUniformGrid } from './cubicaje-packing.util';
import { computeAxleLoads, balanceLoadForAxles } from './cubicaje-axle.util';
import { resolveChassisSpec } from './cubicaje-chassis';
import { resolveContenedorExterior, resolveContenedorInterior } from './cubicaje-dims.util';

export interface BultoInput {
  id?: string;
  label?: string;
  tipo?: string;
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
  tipo?: string;
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
  tipo?: string;
  color: string;
  pesoKg?: number;
}

export interface CubicajeResult {
  modelo: string;
  /** Caja útil interior donde se coloca la carga (m). */
  contenedor: { largo: number; ancho: number; alto: number };
  /** Dimensiones exteriores de la carrocería (m). */
  contenedorExterior?: { largo: number; ancho: number; alto: number };
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
  ejeDelanteroKg?: number;
  ejeTraseroKg?: number;
  ejeDelanteroMaxKg?: number;
  ejeTraseroMaxKg?: number;
  ejeDelanteroOk?: boolean;
  ejeTraseroOk?: boolean;
  ejesOk?: boolean;
  /** Modelo alternativo del catálogo que sí cabe toda la carga (si aplica). */
  modeloSugerido?: string;
  sugerencia?: string;
}

type ModeloDims = {
  largo_aplicacion?: number;
  ancho_aplicacion?: number;
  alto_aplicacion?: number;
  pvb?: number;
  capacidad_carga?: string;
  modelo?: string;
  distancia_entre_ejes?: number;
  cubicaje_peso?: {
    interior_carga_2?: { largo_cm?: number | null; ancho_cm?: number | null; alto_cm?: number | null };
  };
};

type FlatBulto = BultoInput & { id: string; label: string; color: string };

const MM = 1000;
const TARIMA_COLOR = '#c8102e';

@Injectable()
export class CubicajeService {
  private catalog: Record<string, ModeloDims> = {};

  constructor() {
    this.loadCatalog();
  }

  private loadCatalog() {
    const base = process.cwd().endsWith('backend') ? join(process.cwd(), '..') : process.cwd();
    const paths = [
      join(base, 'frontend', 'dist', 'catalog_data.json'),
      join(base, 'frontend', 'public', 'catalog_data.json'),
      join(__dirname, '..', '..', '..', 'frontend', 'public', 'catalog_data.json'),
    ];
    for (const p of paths) {
      if (existsSync(p)) {
        try {
          const raw = readFileSync(p, 'utf-8');
          const data = JSON.parse(raw) as { modelos?: Record<string, ModeloDims> };
          this.catalog = data.modelos || {};
          break;
        } catch {
          //
        }
      }
    }
  }

  calcular(input: CubicajeInput): CubicajeResult {
    const base = this.computePack(input);
    let modeloSugerido: string | undefined;
    let sugerencia: string | undefined;
    if (!base.cabenTodos || !base.pesoOk) {
      const alt = this.findBestModelo(input, input.modelo);
      if (alt) {
        modeloSugerido = alt.modelo;
        sugerencia = alt.mensaje;
      }
    }
    return { ...base, modeloSugerido, sugerencia };
  }

  /** Camión más compacto del catálogo donde cabe toda la carga (peso y volumen). */
  findSmallestFittingModelo(bultos: BultoInput[]): {
    modelo: string;
    utilizacionVolumen: number;
    pesoColocadoKg: number;
    cabenTodos: boolean;
    pesoOk: boolean;
  } | null {
    if (!bultos.length) return null;
    const candidates = Object.keys(this.catalog)
      .map((label) => {
        const mod = this.catalog[label];
        const inner = resolveContenedorInterior(mod);
        return {
          label,
          vol: inner.largo * inner.ancho * inner.alto,
        };
      })
      .sort((a, b) => a.vol - b.vol);

    for (const c of candidates) {
      const trial = this.computePack({ modelo: c.label, bultos });
      if (trial.cabenTodos && trial.pesoOk && trial.ejesOk !== false) {
        return {
          modelo: c.label,
          utilizacionVolumen: trial.utilizacionVolumen,
          pesoColocadoKg: trial.pesoColocadoKg,
          cabenTodos: trial.cabenTodos,
          pesoOk: trial.pesoOk,
        };
      }
    }
    return null;
  }

  private computePack(input: CubicajeInput): CubicajeResult {
    const resolved = this.resolveModelo(input.modelo);
    const mod = resolved?.dims;
    const modeloLabel = resolved?.key ?? input.modelo;
    const exterior = resolveContenedorExterior(mod);
    const interior = resolveContenedorInterior(mod);
    const largo = interior.largo;
    const ancho = interior.ancho;
    const alto = interior.alto;
    const pesoMaxKg = this.resolvePesoMax(mod);

    const flat = this.flattenBultos(input.bultos);
    const totalSolicitados = flat.length;
    const chassis = resolveChassisSpec(modeloLabel, mod);

    const gridTipo = detectUniformGrid(flat);
    let colocados = gridTipo
      ? packUniformGrid(largo, ancho, alto, flat, gridTipo, chassis)
      : this.packWithAlgorithm(largo, ancho, alto, flat, chassis);

    const placedIds = new Set(colocados.map((b) => b.id));
    const noColocados: BultoNoColocado[] = flat
      .filter((b) => !placedIds.has(b.id))
      .map((b) => ({
        id: b.id,
        label: b.label,
        tipo: b.tipo,
        color: b.color,
        pesoKg: b.pesoKg,
      }));

    const totalColocados = colocados.length;
    const noCabe = totalSolicitados - totalColocados;
    const cabenTodos = noCabe === 0;

    const volContenedor = largo * ancho * alto;
    const volUsado = colocados.reduce((s, b) => s + b.largo * b.ancho * b.alto, 0);
    const utilizacionVolumen = volContenedor > 0 ? Math.round((volUsado / volContenedor) * 1000) / 10 : 0;

    const pesoColocadoKg = colocados.reduce((s, b) => s + (b.pesoKg ?? 0), 0);
    const pesoEstimadoKg = input.pesoEstimadoKg ?? (pesoColocadoKg > 0 ? pesoColocadoKg : undefined);
    const pesoOk = pesoMaxKg == null || pesoEstimadoKg == null || pesoEstimadoKg <= pesoMaxKg;

    const axle = computeAxleLoads(colocados, chassis);
    const ejesOk = axle.ejeDelanteroOk && axle.ejeTraseroOk;

    const filas = colocados.length > 0 ? Math.max(...colocados.map((b) => b.fila)) : 0;

    let mensaje = cabenTodos
      ? `Carga completa: ${totalColocados} bulto(s), ${utilizacionVolumen}% del volumen.`
      : `${totalColocados} de ${totalSolicitados} bulto(s) colocados. ${noCabe} no cupieron.`;

    if (!pesoOk && pesoMaxKg != null && pesoEstimadoKg != null) {
      mensaje += ` Peso (${Math.round(pesoEstimadoKg)} kg) supera capacidad (~${Math.round(pesoMaxKg)} kg).`;
    }
    if (!ejesOk && colocados.length > 0) {
      if (!axle.ejeDelanteroOk) {
        mensaje += ` Eje delantero (${axle.ejeDelanteroKg} kg) supera límite (~${axle.ejeDelanteroMaxKg} kg).`;
      }
      if (!axle.ejeTraseroOk) {
        mensaje += ` Eje trasero (${axle.ejeTraseroKg} kg) supera límite (~${axle.ejeTraseroMaxKg} kg).`;
      }
    }

    return {
      modelo: modeloLabel,
      contenedor: { largo, ancho, alto },
      contenedorExterior: exterior,
      bultos: colocados,
      noColocados,
      totalSolicitados,
      totalColocados,
      noCabe,
      cabenTodos,
      utilizacionVolumen,
      pesoEstimadoKg,
      pesoColocadoKg,
      pesoMaxKg,
      pesoOk,
      filas,
      mensaje,
      ejeDelanteroKg: axle.ejeDelanteroKg,
      ejeTraseroKg: axle.ejeTraseroKg,
      ejeDelanteroMaxKg: axle.ejeDelanteroMaxKg,
      ejeTraseroMaxKg: axle.ejeTraseroMaxKg,
      ejeDelanteroOk: axle.ejeDelanteroOk,
      ejeTraseroOk: axle.ejeTraseroOk,
      ejesOk,
    };
  }

  /** Busca el camión más compacto del catálogo donde quepa toda la carga. */
  private findBestModelo(
    input: CubicajeInput,
    excludeModelo: string,
  ): { modelo: string; mensaje: string } | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/\s/g, '');
    const candidates = Object.keys(this.catalog)
      .map((key) => {
        const mod = this.catalog[key];
        const inner = resolveContenedorInterior(mod);
        return {
          label: key,
          vol: inner.largo * inner.ancho * inner.alto,
        };
      })
      .filter((c) => norm(c.label) !== norm(excludeModelo))
      .sort((a, b) => a.vol - b.vol);

    for (const c of candidates) {
      const trial = this.computePack({ ...input, modelo: c.label });
      if (trial.cabenTodos && trial.pesoOk && trial.ejesOk !== false) {
        return {
          modelo: c.label,
          mensaje: `${c.label} cabe toda la carga (${trial.utilizacionVolumen}% del volumen).`,
        };
      }
    }
    return undefined;
  }

  private flattenBultos(bultos: BultoInput[]): FlatBulto[] {
    const out: FlatBulto[] = [];
    bultos.forEach((b, bi) => {
      const baseId = b.id || `bulto-${bi + 1}`;
      const label = b.label || `Bulto ${bi + 1}`;
      const color = b.color || TARIMA_COLOR;
      for (let i = 0; i < b.cantidad; i++) {
        out.push({
          ...b,
          id: `${baseId}-${i + 1}`,
          label: b.cantidad > 1 ? `${label} #${i + 1}` : label,
          color,
          cantidad: 1,
        });
      }
    });
    return out;
  }

  private assignFilas(bultos: BultoColocado[], contLargo: number): BultoColocado[] {
    if (bultos.length === 0) return bultos;
    const slice = contLargo / 4;
    return bultos.map((b) => ({
      ...b,
      fila: Math.min(4, Math.max(1, Math.floor(b.x / slice) + 1)),
    }));
  }

  private packWithAlgorithm(
    contL: number,
    contW: number,
    contH: number,
    items: FlatBulto[],
    chassis?: ReturnType<typeof resolveChassisSpec>,
  ): BultoColocado[] {
    const strategies: Array<(a: FlatBulto, b: FlatBulto) => number> = [
      (a, b) => b.largo * b.ancho * b.alto - a.largo * a.ancho * a.alto,
      (a, b) => b.largo * b.ancho - a.largo * a.ancho,
      (a, b) => Math.max(b.largo, b.ancho, b.alto) - Math.max(a.largo, a.ancho, a.alto),
      (a, b) => b.alto - a.alto,
    ];

    let best: BultoColocado[] = [];
    for (const cmp of strategies) {
      const packed = this.runSinglePack(contL, contW, contH, [...items].sort(cmp));
      if (packed.length > best.length) best = packed;
      if (packed.length === items.length) break;
    }
    let placed = this.assignFilas(best, contL);
    if (chassis) placed = balanceLoadForAxles(placed, contL, chassis);
    return placed;
  }

  private runSinglePack(
    contL: number,
    contW: number,
    contH: number,
    sorted: FlatBulto[],
  ): BultoColocado[] {
    const container = new Container(
      'camion',
      Math.round(contL * MM),
      Math.round(contW * MM),
      Math.round(contH * MM),
    );
    const packItems = sorted.map(
      (b) =>
        new Item(
          b.id,
          Math.round(b.largo * MM),
          Math.round(b.ancho * MM),
          Math.round(b.alto * MM),
          1,
        ),
    );
    const result = PackingService.packSingle(container, packItems);
    const packed = result.algorithmPackingResults[0]?.packedItems ?? [];

    return packed.map((p) => {
      const src = sorted.find((i) => i.id === p.id);
      return {
        id: p.id,
        label: src?.label || p.id,
        tipo: src?.tipo,
        x: p.coordX / MM,
        y: p.coordY / MM,
        z: p.coordZ / MM,
        largo: p.packDimX / MM,
        ancho: p.packDimZ / MM,
        alto: p.packDimY / MM,
        color: src?.color || TARIMA_COLOR,
        pesoKg: src?.pesoKg,
        fila: 1,
        colocado: true,
      };
    });
  }

  private resolvePesoMax(mod?: ModeloDims): number | undefined {
    if (mod?.capacidad_carga) {
      const m = mod.capacidad_carga.match(/([\d.]+)/);
      if (m) return parseFloat(m[1]) * 1000;
    }
    return undefined;
  }

  private findModeloByKey(q: string): { key: string; dims: ModeloDims } | undefined {
    const norm = (s: string) => s.toLowerCase().replace(/\s/g, '');
    const nq = norm(q);
    if (!nq) return undefined;

    if (this.catalog[q]) return { key: q, dims: this.catalog[q] };

    for (const [key, dims] of Object.entries(this.catalog)) {
      if (norm(key) === nq) return { key, dims };
      const label = dims.modelo;
      if (label && norm(label) === nq) return { key, dims };
    }

    for (const [key, dims] of Object.entries(this.catalog)) {
      if (norm(key).includes(nq) || nq.includes(norm(key))) return { key, dims };
      const label = dims.modelo;
      if (label && (norm(label).includes(nq) || nq.includes(norm(label)))) return { key, dims };
    }

    return undefined;
  }

  private resolveModelo(q: string): { key: string; dims: ModeloDims } | undefined {
    return this.findModeloByKey(q);
  }
}
