import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Container, Item, PackingService } from '3d-bin-packing-ts';

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
};

type FlatBulto = BultoInput & { id: string; label: string; color: string };

const MM = 1000;
const MARGEN = 0.05;
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

  private computePack(input: CubicajeInput): CubicajeResult {
    const mod = this.catalog[input.modelo] || this.findModeloByKey(input.modelo);
    const largo = mod?.largo_aplicacion ?? 6;
    const ancho = mod?.ancho_aplicacion ?? 2.2;
    const alto = mod?.alto_aplicacion ?? 2.2;
    const pesoMaxKg = this.resolvePesoMax(mod);

    const flat = this.flattenBultos(input.bultos);
    const totalSolicitados = flat.length;

    const soloTarimasUniformes =
      input.bultos.length === 1 &&
      input.bultos[0].tipo === 'tarima' &&
      totalSolicitados > 0;

    const colocados = soloTarimasUniformes
      ? this.packTarimasUpright(largo, ancho, alto, flat[0], totalSolicitados)
      : this.packWithAlgorithm(largo, ancho, alto, flat);

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

    const filas = colocados.length > 0 ? Math.max(...colocados.map((b) => b.fila)) : 0;

    let mensaje = cabenTodos
      ? `Carga completa: ${totalColocados} bulto(s), ${utilizacionVolumen}% del volumen.`
      : `${totalColocados} de ${totalSolicitados} bulto(s) colocados. ${noCabe} no cupieron.`;

    if (!pesoOk && pesoMaxKg != null && pesoEstimadoKg != null) {
      mensaje += ` Peso (${Math.round(pesoEstimadoKg)} kg) supera capacidad (~${Math.round(pesoMaxKg)} kg).`;
    }

    return {
      modelo: input.modelo,
      contenedor: { largo, ancho, alto },
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
        return {
          label: key,
          vol:
            (mod.largo_aplicacion ?? 6) *
            (mod.ancho_aplicacion ?? 2.2) *
            (mod.alto_aplicacion ?? 2.2),
        };
      })
      .filter((c) => norm(c.label) !== norm(excludeModelo))
      .sort((a, b) => a.vol - b.vol);

    for (const c of candidates) {
      const trial = this.computePack({ ...input, modelo: c.label });
      if (trial.cabenTodos && trial.pesoOk) {
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

  private packTarimasUpright(
    contL: number,
    contW: number,
    contH: number,
    tarima: FlatBulto,
    count: number,
  ): BultoColocado[] {
    const tL = tarima.largo;
    const tW = tarima.ancho;
    const tH = tarima.alto;
    const usableL = contL - 2 * MARGEN;
    const usableW = contW - 2 * MARGEN;
    const usableH = contH - 2 * MARGEN;

    type Layout = { cols: number; rows: number; cellL: number; cellW: number; perLayer: number };
    const layouts: Layout[] = [];

    const tryLayout = (cellL: number, cellW: number) => {
      const cols = Math.floor(usableW / cellW);
      const rows = Math.floor(usableL / cellL);
      if (cols > 0 && rows > 0) {
        layouts.push({ cols, rows, cellL, cellW, perLayer: cols * rows });
      }
    };
    tryLayout(tL, tW);
    tryLayout(tW, tL);

    layouts.sort((a, b) => b.perLayer - a.perLayer);
    const layout = layouts[0];
    if (!layout) return [];

    const maxLayers = Math.floor(usableH / tH);
    const maxTotal = layout.perLayer * maxLayers;
    const toPlace = Math.min(count, maxTotal);
    const result: BultoColocado[] = [];

    for (let i = 0; i < toPlace; i++) {
      const layer = Math.floor(i / layout.perLayer);
      const idx = i % layout.perLayer;
      const row = Math.floor(idx / layout.cols);
      const col = idx % layout.cols;
      result.push({
        id: tarima.id,
        label: count > 1 ? `Tarima #${i + 1}` : tarima.label,
        tipo: tarima.tipo,
        x: MARGEN + row * layout.cellL,
        y: layer * tH,
        z: MARGEN + col * layout.cellW,
        largo: layout.cellL,
        ancho: layout.cellW,
        alto: tH,
        color: tarima.color,
        pesoKg: tarima.pesoKg,
        fila: row + 1,
        colocado: true,
      });
    }
    return this.assignFilas(result, contL);
  }

  private packWithAlgorithm(
    contL: number,
    contW: number,
    contH: number,
    items: FlatBulto[],
  ): BultoColocado[] {
    const sorted = [...items].sort(
      (a, b) => b.largo * b.ancho * b.alto - a.largo * a.ancho * a.alto,
    );

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

    const colocados = packed.map((p) => {
      const src = items.find((i) => i.id === p.id);
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
    return this.assignFilas(colocados, contL);
  }

  private resolvePesoMax(mod?: ModeloDims): number | undefined {
    if (mod?.pvb != null) return mod.pvb * 1000;
    if (mod?.capacidad_carga) {
      const m = mod.capacidad_carga.match(/([\d.]+)/);
      if (m) return parseFloat(m[1]) * 1000;
    }
    return undefined;
  }

  private findModeloByKey(q: string): ModeloDims | undefined {
    const key = Object.keys(this.catalog).find(
      (k) => k.toLowerCase().replace(/\s/g, '') === q.toLowerCase().replace(/\s/g, ''),
    );
    return key ? this.catalog[key] : undefined;
  }
}
