import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { Container, Item, PackingService } from '3d-bin-packing-ts';

export interface BultoInput {
  id?: string;
  label?: string;
  largo: number;
  ancho: number;
  alto: number;
  cantidad: number;
  color?: string;
}

export interface CubicajeInput {
  modelo: string;
  bultos: BultoInput[];
  pesoEstimadoKg?: number;
}

export interface BultoColocado {
  id: string;
  label: string;
  x: number;
  y: number;
  z: number;
  largo: number;
  ancho: number;
  alto: number;
  color: string;
}

export interface CubicajeResult {
  modelo: string;
  contenedor: { largo: number; ancho: number; alto: number };
  bultos: BultoColocado[];
  totalSolicitados: number;
  totalColocados: number;
  noCabe: number;
  cabenTodos: boolean;
  utilizacionVolumen: number;
  pesoEstimadoKg?: number;
  pesoMaxKg?: number;
  pesoOk: boolean;
  mensaje: string;
}

type ModeloDims = {
  largo_aplicacion?: number;
  ancho_aplicacion?: number;
  alto_aplicacion?: number;
  pvb?: number;
  capacidad_carga?: string;
};

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
    const mod = this.catalog[input.modelo] || this.findModeloByKey(input.modelo);
    const largo = mod?.largo_aplicacion ?? 6;
    const ancho = mod?.ancho_aplicacion ?? 2.2;
    const alto = mod?.alto_aplicacion ?? 2.2;
    const pesoMaxKg = this.resolvePesoMax(mod);

    const flat = this.flattenBultos(input.bultos);
    const totalSolicitados = flat.length;

    const uniformTarima =
      input.bultos.length === 1 &&
      input.bultos[0].cantidad > 0 &&
      totalSolicitados > 0;

    const bultos = uniformTarima
      ? this.packTarimasUpright(largo, ancho, alto, flat[0], totalSolicitados)
      : this.packWithAlgorithm(largo, ancho, alto, flat);

    const totalColocados = bultos.length;
    const noCabe = totalSolicitados - totalColocados;
    const cabenTodos = noCabe === 0;

    const volContenedor = largo * ancho * alto;
    const volUsado = bultos.reduce((s, b) => s + b.largo * b.ancho * b.alto, 0);
    const utilizacionVolumen = volContenedor > 0 ? Math.round((volUsado / volContenedor) * 1000) / 10 : 0;

    const pesoEstimadoKg = input.pesoEstimadoKg;
    const pesoOk = pesoMaxKg == null || pesoEstimadoKg == null || pesoEstimadoKg <= pesoMaxKg;

    let mensaje = cabenTodos
      ? `Se colocaron ${totalColocados} bulto(s). Utilización de volumen: ${utilizacionVolumen}%.`
      : `Solo caben ${totalColocados} de ${totalSolicitados} bulto(s). Considera un camión más grande o menos carga.`;

    if (!pesoOk && pesoMaxKg != null && pesoEstimadoKg != null) {
      mensaje += ` Peso estimado (${pesoEstimadoKg} kg) supera capacidad (~${Math.round(pesoMaxKg)} kg).`;
    }

    return {
      modelo: input.modelo,
      contenedor: { largo, ancho, alto },
      bultos,
      totalSolicitados,
      totalColocados,
      noCabe,
      cabenTodos,
      utilizacionVolumen,
      pesoEstimadoKg,
      pesoMaxKg,
      pesoOk,
      mensaje,
    };
  }

  private flattenBultos(bultos: BultoInput[]): Array<BultoInput & { id: string; label: string; color: string }> {
    const out: Array<BultoInput & { id: string; label: string; color: string }> = [];
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

  /** Apila tarimas verticales (rotación solo en planta). */
  private packTarimasUpright(
    contL: number,
    contW: number,
    contH: number,
    tarima: BultoInput,
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
        id: `${tarima.id || 'tarima'}-${i + 1}`,
        label: count > 1 ? `Tarima #${i + 1}` : 'Tarima',
        x: MARGEN + row * layout.cellL,
        y: layer * tH,
        z: MARGEN + col * layout.cellW,
        largo: layout.cellL,
        ancho: layout.cellW,
        alto: tH,
        color: tarima.color || TARIMA_COLOR,
      });
    }
    return result;
  }

  private packWithAlgorithm(
    contL: number,
    contW: number,
    contH: number,
    items: Array<BultoInput & { id: string; label: string; color: string }>,
  ): BultoColocado[] {
    const container = new Container(
      'camion',
      Math.round(contL * MM),
      Math.round(contW * MM),
      Math.round(contH * MM),
    );
    const packItems = items.map(
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
      const src = items.find((i) => i.id === p.id);
      return {
        id: p.id,
        label: src?.label || p.id,
        x: p.coordX / MM,
        y: p.coordY / MM,
        z: p.coordZ / MM,
        largo: p.packDimX / MM,
        ancho: p.packDimZ / MM,
        alto: p.packDimY / MM,
        color: src?.color || TARIMA_COLOR,
      };
    });
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
