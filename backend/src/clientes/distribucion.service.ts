import { Injectable } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface DistribucionInput {
  /** Modelo (ELF 500K, FORWARD 800K, etc.) */
  modelo: string;
  /** Cantidad de tarimas */
  cantidadTarimas: number;
  /** Largo tarima en metros (default 1.2) */
  tarimaLargo?: number;
  /** Ancho tarima en metros (default 1.0) */
  tarimaAncho?: number;
  /** Alto tarima en metros (default 1.5) */
  tarimaAlto?: number;
}

export interface PosicionTarima {
  x: number;
  y: number;
  fila: number;
  col: number;
  orientacion: 'largo' | 'ancho'; // eje largo de tarima: a lo largo o ancho del camión
}

export interface DistribucionResult {
  modelo: string;
  largoCamion: number;
  anchoCamion: number;
  altoCamion: number;
  tarimas: PosicionTarima[];
  filas: number;
  columnas: number;
  cabenTodas: boolean;
  mensaje: string;
}

@Injectable()
export class DistribucionService {
  private catalog: Record<string, { largo_aplicacion?: number; ancho_aplicacion?: number; alto_aplicacion?: number }> =
    {};

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
          const data = JSON.parse(raw) as { modelos?: Record<string, unknown> };
          this.catalog = (data.modelos || {}) as Record<string, { largo_aplicacion?: number; ancho_aplicacion?: number; alto_aplicacion?: number }>;
          break;
        } catch {
          //
        }
      }
    }
  }

  /** Calcula distribución de tarimas en camión. Retorna posiciones para SVG. */
  calcular(input: DistribucionInput): DistribucionResult {
    const largo = input.tarimaLargo ?? 1.2;
    const ancho = input.tarimaAncho ?? 1.0;
    const alto = input.tarimaAlto ?? 1.5;

    const mod = this.catalog[input.modelo] || this.findModeloByKey(input.modelo);
    const largoCamion = mod?.largo_aplicacion ?? 6;
    const anchoCamion = mod?.ancho_aplicacion ?? 2.2;
    const altoCamion = mod?.alto_aplicacion ?? 2.2;

    const tarimas: PosicionTarima[] = [];
    const margen = 0.1;

    // Área útil
    const L = largoCamion - 2 * margen;
    const W = anchoCamion - 2 * margen;

    // Probar orientación: tarima con largo a lo largo del camión (L) o al ancho (W)
    let filas = 0;
    let columnas = 0;
    let orientacion: 'largo' | 'ancho' = 'largo';

    // Opción A: largo de tarima paralelo a largo del camión
    const colsA = Math.floor(W / ancho);
    const filasA = Math.floor(L / largo);
    const capA = colsA * filasA;

    // Opción B: largo de tarima perpendicular
    const colsB = Math.floor(W / largo);
    const filasB = Math.floor(L / ancho);
    const capB = colsB * filasB;

    if (capB >= capA && capB >= input.cantidadTarimas) {
      orientacion = 'ancho';
      columnas = colsB;
      filas = Math.ceil(input.cantidadTarimas / columnas) || 1;
    } else {
      orientacion = 'largo';
      columnas = colsA;
      filas = Math.ceil(input.cantidadTarimas / columnas) || 1;
    }

    const cellW = orientacion === 'largo' ? ancho : largo;
    const cellL = orientacion === 'largo' ? largo : ancho;

    for (let i = 0; i < input.cantidadTarimas; i++) {
      const f = Math.floor(i / columnas);
      const c = i % columnas;
      tarimas.push({
        x: margen + c * cellW,
        y: margen + f * cellL,
        fila: f + 1,
        col: c + 1,
        orientacion,
      });
    }

    const cabenTodas =
      (orientacion === 'largo' ? filas * columnas : filas * columnas) >= input.cantidadTarimas &&
      (orientacion === 'largo' ? filas * cellL : filas * cellL) <= L &&
      columnas * cellW <= W;

    let mensaje = cabenTodas
      ? `Se acomodan ${input.cantidadTarimas} tarimas en ${filas} fila(s) x ${columnas} columna(s).`
      : `Solo caben aproximadamente ${Math.min(filas * columnas, input.cantidadTarimas)} tarimas. Considera un camión más grande.`;

    return {
      modelo: input.modelo,
      largoCamion,
      anchoCamion,
      altoCamion,
      tarimas,
      filas,
      columnas,
      cabenTodas,
      mensaje,
    };
  }

  private findModeloByKey(q: string): { largo_aplicacion?: number; ancho_aplicacion?: number; alto_aplicacion?: number } | undefined {
    const key = Object.keys(this.catalog).find(
      (k) => k.toLowerCase().replace(/\s/g, '') === q.toLowerCase().replace(/\s/g, ''),
    );
    return key ? this.catalog[key] : undefined;
  }

  /** Genera SVG de la distribución (vista superior) */
  generarSvg(result: DistribucionResult, input: DistribucionInput): string {
    const scale = 90; // 1 m = 90 px (escala fija para comparar modelos)
    const l = result.largoCamion * scale;
    const w = result.anchoCamion * scale;
    const tarimaL = (input.tarimaLargo ?? 1.2) * scale;
    const tarimaW = (input.tarimaAncho ?? 1.0) * scale;
    const pad = 58;
    const vbW = l + pad * 2;
    const vbH = w + pad * 2 + 24;

    const svgTarimas = result.tarimas
      .map((t) => {
        const tw = t.orientacion === 'largo' ? tarimaL : tarimaW;
        const tl = t.orientacion === 'largo' ? tarimaW : tarimaL;
        const x = t.x * scale;
        const y = t.y * scale;
        return `<rect x="${x}" y="${y}" width="${tw}" height="${tl}" fill="#c8102e" fill-opacity="0.85" stroke="#8b0a1f" stroke-width="2" rx="4"/><text x="${x + tw / 2}" y="${y + tl / 2}" fill="white" font-size="11" font-weight="bold" text-anchor="middle" dominant-baseline="middle">${t.fila}-${t.col}</text>`;
      })
      .join('\n');

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  <rect x="0" y="0" width="${vbW}" height="${vbH}" fill="#ffffff"/>
  <text x="${vbW / 2}" y="18" fill="#202124" font-size="13" font-weight="700" text-anchor="middle">${result.modelo} — Distribución a escala real (catálogo ISUZU México)</text>
  <text x="${vbW / 2}" y="34" fill="#5f6368" font-size="11" text-anchor="middle">Escala: 1 m = ${scale} px | Caja: ${result.largoCamion.toFixed(2)} m x ${result.anchoCamion.toFixed(2)} m x ${result.altoCamion.toFixed(2)} m</text>

  <rect x="${pad}" y="${pad}" width="${l}" height="${w}" fill="#f6f7f8" stroke="#2c2f33" stroke-width="2.2" rx="6"/>
  <g transform="translate(${pad},${pad})">
    ${svgTarimas}
  </g>

  <line x1="${pad}" y1="${pad - 16}" x2="${pad + l}" y2="${pad - 16}" stroke="#374151" stroke-width="1.2"/>
  <line x1="${pad}" y1="${pad - 22}" x2="${pad}" y2="${pad - 10}" stroke="#374151" stroke-width="1.2"/>
  <line x1="${pad + l}" y1="${pad - 22}" x2="${pad + l}" y2="${pad - 10}" stroke="#374151" stroke-width="1.2"/>
  <text x="${pad + l / 2}" y="${pad - 22}" fill="#374151" font-size="10.5" text-anchor="middle">Largo caja: ${result.largoCamion.toFixed(2)} m</text>

  <line x1="${pad - 18}" y1="${pad}" x2="${pad - 18}" y2="${pad + w}" stroke="#374151" stroke-width="1.2"/>
  <line x1="${pad - 24}" y1="${pad}" x2="${pad - 12}" y2="${pad}" stroke="#374151" stroke-width="1.2"/>
  <line x1="${pad - 24}" y1="${pad + w}" x2="${pad - 12}" y2="${pad + w}" stroke="#374151" stroke-width="1.2"/>
  <text x="${pad - 26}" y="${pad + w / 2}" fill="#374151" font-size="10.5" text-anchor="end" dominant-baseline="middle">Ancho: ${result.anchoCamion.toFixed(2)} m</text>

  <rect x="${vbW - 140}" y="${vbH - 44}" width="90" height="8" fill="#9ca3af" rx="2"/>
  <text x="${vbW - 95}" y="${vbH - 50}" fill="#4b5563" font-size="10" text-anchor="middle">1 m</text>
  <text x="${pad}" y="${vbH - 10}" fill="#5f6368" font-size="10.5">${result.mensaje}</text>
</svg>`;
  }
}
