import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export type ChatRole = 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

const DEFAULT_MODEL = 'gpt-4o-mini';

/** Límite aproximado de caracteres del listado compacto (evita prompts enormes). */
const MAX_COMPACT_CATALOG_CHARS = 14_000;
/** Modelos con detalle ampliado cuando coinciden con la pregunta. */
const MAX_RELEVANT_DETAIL = 15;

type RawModel = {
  modelo?: string;
  linea?: string;
  precio?: number;
  precio_2026?: number;
  precio_2025?: number;
  capacidad_carga?: string;
  km_litro?: string;
  motor?: string;
  hp?: string;
  torque?: string;
  garantia?: string;
  ano_modelo?: number;
  tecnologia?: string;
};

export type CatalogRow = {
  key: string;
  modelo: string;
  linea: string;
  precio: number | null;
  precio_2026: number | null;
  precio_2025: number | null;
  capacidad_carga: string;
  km_litro: string;
  motor: string;
  hp: string;
  torque: string;
  garantia: string;
  ano_modelo: number | null;
  tecnologia: string;
  /** Texto para coincidencia con la pregunta del usuario */
  searchBlob: string;
};

const STOP_WORDS = new Set([
  'el',
  'la',
  'los',
  'las',
  'un',
  'una',
  'de',
  'en',
  'y',
  'a',
  'que',
  'es',
  'por',
  'para',
  'con',
  'se',
  'no',
  'me',
  'mi',
  'tu',
  'te',
  'lo',
  'al',
  'del',
  'le',
  'da',
  'su',
  'son',
  'hay',
  'muy',
  'mas',
  'menos',
  'como',
  'cual',
  'qué',
  'que',
  'este',
  'esta',
  'eso',
  'los',
  'mejor',
  'busco',
  'necesito',
  'quiero',
  'gracias',
  'hola',
  'buenos',
  'dias',
  'días',
  'camion',
  'camión',
  'isuzu',
  'modelo',
  'modelos',
  'precio',
  'precios',
  'carga',
  'toneladas',
  'tonelada',
]);

@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);
  private catalogSummary = '';
  private catalogCompact = '';
  private catalogRows: CatalogRow[] = [];

  onModuleInit() {
    this.loadCatalogFromDisk();
  }

  private catalogPaths(): string[] {
    return [
      join(__dirname, '..', '..', 'frontend', 'dist', 'catalog_data.json'),
      join(__dirname, '..', '..', 'frontend', 'public', 'catalog_data.json'),
    ];
  }

  private loadCatalogFromDisk(): void {
    for (const p of this.catalogPaths()) {
      if (!existsSync(p)) continue;
      try {
        const raw = readFileSync(p, 'utf-8');
        const data = JSON.parse(raw) as { modelos?: Record<string, RawModel> };
        const obj = data.modelos || {};
        const rows: CatalogRow[] = Object.entries(obj).map(([key, m]) => {
          const modelo = (m.modelo || key).trim();
          const linea = String(m.linea || '').trim();
          const precio = typeof m.precio === 'number' ? m.precio : null;
          const precio_2026 = typeof m.precio_2026 === 'number' ? m.precio_2026 : null;
          const precio_2025 = typeof m.precio_2025 === 'number' ? m.precio_2025 : null;
          const capacidad_carga = String(m.capacidad_carga || '').trim();
          const km_litro = String(m.km_litro || '').trim();
          const motor = String(m.motor || '').trim();
          const hp = String(m.hp || '').trim();
          const torque = String(m.torque || '').trim();
          const garantia = String(m.garantia || '').trim();
          const ano_modelo = typeof m.ano_modelo === 'number' ? m.ano_modelo : null;
          const tecnologia = String(m.tecnologia || '').trim();
          const searchBlob = [
            modelo,
            linea,
            capacidad_carga,
            km_litro,
            motor,
            hp,
            torque,
            tecnologia,
            garantia,
          ]
            .join(' ')
            .toLowerCase()
            .normalize('NFD')
            .replace(/\p{M}/gu, '');
          return {
            key,
            modelo,
            linea,
            precio,
            precio_2026,
            precio_2025,
            capacidad_carga,
            km_litro,
            motor,
            hp,
            torque,
            garantia,
            ano_modelo,
            tecnologia,
            searchBlob,
          };
        });
        rows.sort((a, b) => a.modelo.localeCompare(b.modelo, 'es', { numeric: true }));
        this.catalogRows = rows;
        this.catalogSummary = this.buildSummary(rows);
        this.catalogCompact = this.buildCompactTable(rows);
        this.logger.log(`Catálogo asistente: ${rows.length} modelos desde ${p}`);
        return;
      } catch (e) {
        this.logger.warn(`No se pudo leer catálogo en ${p}: ${e}`);
      }
    }
    this.catalogSummary =
      'No hay archivo catalog_data.json; no inventes datos de modelos ni precios.';
    this.catalogCompact = '';
    this.catalogRows = [];
  }

  private fmtMoney(n: number | null): string {
    if (n == null || Number.isNaN(n)) return '—';
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      maximumFractionDigits: 0,
    }).format(n);
  }

  private buildSummary(rows: CatalogRow[]): string {
    if (rows.length === 0) return this.catalogSummary;
    const precios = rows.map((r) => r.precio ?? r.precio_2026).filter((n): n is number => typeof n === 'number');
    const lineas = [...new Set(rows.map((r) => r.linea).filter(Boolean))];
    const minP = precios.length ? Math.min(...precios) : null;
    const maxP = precios.length ? Math.max(...precios) : null;
    return [
      `Total modelos en catálogo: ${rows.length}.`,
      lineas.length ? `Líneas: ${lineas.join(', ')}.` : '',
      minP != null && maxP != null
        ? `Rango de precio de lista en datos (MXN): ${this.fmtMoney(minP)} – ${this.fmtMoney(maxP)}.`
        : '',
      'Usa el listado compacto y el bloque de relevantes como fuente de verdad para cifras.',
    ]
      .filter(Boolean)
      .join(' ');
  }

  /** Una línea por modelo; truncado si excede límite. */
  private buildCompactTable(rows: CatalogRow[]): string {
    const lines = rows.map((r) => {
      const p = r.precio ?? r.precio_2026;
      const motorShort = r.motor.length > 70 ? `${r.motor.slice(0, 67)}…` : r.motor;
      return `${r.modelo} | ${r.linea || '—'} | ${this.fmtMoney(p)} | ${r.capacidad_carga || '—'} | ${r.km_litro || '—'} | ${motorShort || '—'}`;
    });
    let joined = lines.join('\n');
    if (joined.length > MAX_COMPACT_CATALOG_CHARS) {
      joined =
        joined.slice(0, MAX_COMPACT_CATALOG_CHARS) +
        '\n[…listado truncado por tamaño; prioriza el bloque de modelos relevantes o pide un modelo concreto…]';
    }
    return joined;
  }

  private tokenize(query: string): string[] {
    const q = query
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return q
      .split(/[^a-z0-9ñ]+/)
      .map((t) => t.trim())
      .filter((t) => t.length >= 2 && !STOP_WORDS.has(t));
  }

  /** Modelos que mejor coinciden con el texto del usuario (última pregunta). */
  private pickRelevantModels(query: string): CatalogRow[] {
    if (!query.trim() || this.catalogRows.length === 0) return [];
    const qLower = query.toLowerCase();
    const tokens = this.tokenize(query);

    const scored = this.catalogRows.map((r) => {
      let s = 0;
      if (qLower.includes(r.modelo.toLowerCase())) s += 25;
      const modeloParts = r.modelo.toLowerCase().split(/\s+/);
      for (const part of modeloParts) {
        if (part.length >= 2 && qLower.includes(part)) s += 3;
      }
      for (const t of tokens) {
        if (r.searchBlob.includes(t)) s += 2;
      }
      if (r.linea && qLower.includes(r.linea.toLowerCase())) s += 5;
      return { r, s };
    });

    scored.sort((a, b) => b.s - a.s);
    const withHits = scored.filter((x) => x.s > 0).slice(0, MAX_RELEVANT_DETAIL).map((x) => x.r);
    if (withHits.length > 0) return withHits;

    // Sin coincidencias: enviar muestra representativa (ELF + Forward) para que el modelo no alucine
    const elf = this.catalogRows.filter((r) => r.linea?.toUpperCase() === 'ELF').slice(0, 6);
    const fwd = this.catalogRows
      .filter((r) => r.linea?.toUpperCase() === 'FORWARD')
      .slice(0, 4);
    return [...elf, ...fwd].slice(0, MAX_RELEVANT_DETAIL);
  }

  private formatRelevantBlock(rows: CatalogRow[]): string {
    if (rows.length === 0) return '';
    const lines = rows.map((r) => {
      const pLista = r.precio ?? r.precio_2026;
      const extra =
        r.precio_2026 != null && r.precio != null && r.precio_2026 !== r.precio
          ? ` | Ref.2026: ${this.fmtMoney(r.precio_2026)}`
          : '';
      const motor = r.motor.length > 160 ? `${r.motor.slice(0, 157)}…` : r.motor;
      return (
        `- **${r.modelo}** (${r.linea || '—'}) — Precio lista: ${this.fmtMoney(pLista)}${extra} | ` +
        `Carga: ${r.capacidad_carga || '—'} | km/L: ${r.km_litro || '—'} | Año: ${r.ano_modelo ?? '—'}\n` +
        `  Motor: ${motor || '—'} | HP/torque: ${r.hp || '—'} ${r.torque ? `/ ${r.torque}` : ''} | Garantía: ${r.garantia || '—'} | Tecnología: ${r.tecnologia || '—'}`
      );
    });
    return `### Modelos más relevantes para esta consulta (datos del catálogo)\n${lines.join('\n')}`;
  }

  private lastUserMessage(history: ChatMessage[]): string {
    for (let i = history.length - 1; i >= 0; i--) {
      if (history[i].role === 'user') return history[i].content;
    }
    return '';
  }

  private systemPrompt(relevantBlock: string): string {
    const compactSection = this.catalogCompact
      ? `--- CATÁLOGO COMPLETO (formato: modelo | línea | precio lista MXN | capacidad | km/L | motor resumido) ---\n${this.catalogCompact}`
      : '(No hay listado compacto cargado.)';

    const relevantSection = relevantBlock ? `\n\n${relevantBlock}` : '';

    return `Eres el asistente virtual de ISUZU Cotizador (México) para clientes que buscan camión de carga.

Tu objetivo: ayudar a elegir o acotar opciones según:
- Peso o capacidad de carga (toneladas).
- Presupuesto o rango de precio.
- Giro: reparto, refrigerado, construcción, materiales, paquetería, etc.
- Eficiencia (km/L), ruta, tipo de caja.

**Fuente de datos:** El bloque "CATÁLOGO COMPLETO" y "Modelos más relevantes" contienen datos extraídos del cotizador oficial. 
- Puedes citar **precios, capacidades, motor, km/L, garantía** tal como aparecen ahí.
- Si el usuario pide un modelo que **no** aparece en esos bloques, no inventes: dilo y sugiere revisar el Catálogo en la app o reformular.
- No prometas disponibilidad, entrega ni condiciones comerciales finales: remite a asesor/distribuidor.

Estilo: español (México), profesional, listas breves con viñetas cuando ayude.

Resumen del catálogo:
${this.catalogSummary}

${compactSection}
${relevantSection}`;
  }

  async completeChat(history: ChatMessage[]): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY no está configurada. Añádela en el archivo .env de la raíz del proyecto o en las variables de Railway.',
      );
    }

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const trimmed = history.slice(-20).filter((m) => m.role === 'user' || m.role === 'assistant');
    if (trimmed.length === 0) {
      throw new BadRequestException('Envía al menos un mensaje.');
    }
    if (!trimmed.some((m) => m.role === 'user')) {
      throw new BadRequestException('Se requiere al menos un mensaje del usuario.');
    }

    const lastUser = this.lastUserMessage(trimmed);
    const relevant = this.pickRelevantModels(lastUser);
    const relevantBlock = this.formatRelevantBlock(relevant);

    const messages = [
      { role: 'system' as const, content: this.systemPrompt(relevantBlock) },
      ...trimmed.map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    ];

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        temperature: 0.55,
        max_tokens: 1400,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`OpenAI ${res.status}: ${errText.slice(0, 500)}`);
      throw new ServiceUnavailableException(
        res.status === 401
          ? 'API key de OpenAI inválida o expirada.'
          : 'No se pudo contactar al modelo. Revisa créditos y configuración.',
      );
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const text = body.choices?.[0]?.message?.content?.trim();
    if (!text) {
      throw new ServiceUnavailableException('Respuesta vacía del modelo.');
    }
    return text;
  }
}
