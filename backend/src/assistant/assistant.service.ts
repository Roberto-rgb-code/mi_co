import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { ModelosService } from '../modelos/modelos.service';

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

  constructor(private readonly modelosService: ModelosService) {}

  async onModuleInit() {
    await this.loadCatalog();
  }

  /** Carga catálogo: prioridad DB, fallback JSON. Solo datos de México. */
  private async loadCatalog(): Promise<void> {
    try {
      const dbRows = await this.modelosService.findAll();
      if (dbRows && dbRows.length > 0) {
        const rows = dbRows.map((m) => this.modeloToCatalogRow(m));
        rows.sort((a, b) => a.modelo.localeCompare(b.modelo, 'es', { numeric: true }));
        this.catalogRows = rows;
        this.catalogSummary = this.buildSummary(rows);
        this.catalogCompact = this.buildCompactTable(rows);
        this.logger.log(`Catálogo asistente: ${rows.length} modelos desde base de datos (solo México)`);
        return;
      }
    } catch (e) {
      this.logger.warn(`No se pudo cargar catálogo desde DB: ${e}`);
    }
    this.loadCatalogFromDisk();
  }

  private modeloToCatalogRow(m: {
    catalogo: string;
    familia: string;
    precio: number;
    capacidadCarga?: string | null;
    motor?: string | null;
    hp?: string | null;
    torque?: string | null;
    garantia?: string | null;
    kmPorLitro?: string | null;
    tecnologia?: string | null;
    yearModelo?: number;
  }): CatalogRow {
    const modelo = (m.catalogo || '').trim();
    const linea = (m.familia || '').trim();
    const searchBlob = [modelo, linea, m.capacidadCarga || '', m.kmPorLitro || '', m.motor || '', m.hp || '', m.torque || '', m.tecnologia || '', m.garantia || '']
      .join(' ')
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
    return {
      key: modelo,
      modelo,
      linea,
      precio: typeof m.precio === 'number' ? m.precio : null,
      precio_2026: typeof m.precio === 'number' ? m.precio : null,
      precio_2025: null,
      capacidad_carga: String(m.capacidadCarga || '').trim(),
      km_litro: String(m.kmPorLitro || '').trim(),
      motor: String(m.motor || '').trim(),
      hp: String(m.hp || '').trim(),
      torque: String(m.torque || '').trim(),
      garantia: String(m.garantia || '').trim(),
      ano_modelo: typeof m.yearModelo === 'number' ? m.yearModelo : null,
      tecnologia: String(m.tecnologia || '').trim(),
      searchBlob,
    };
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
      'No hay catálogo (ni DB ni JSON). Responde que no hay datos disponibles y no inventes nada.';
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

  private systemPrompt(relevantBlock: string, clientContext?: string): string {
    const contextSection =
      clientContext && clientContext.length > 0
        ? `\n\n--- CONTEXTO DEL CLIENTE (CRM) ---\n${clientContext}\nUsa estos datos para recomendar modelos con argumentos concretos. Si hay producto (ej. peras) y tarimas, sugiere distribución, tipo de caja y capacidades.\n---`
        : '';

    const compactSection = this.catalogCompact
      ? `--- ÚNICA FUENTE DE DATOS VÁLIDA (modelo | línea | precio MXN | capacidad | km/L | motor) ---\n${this.catalogCompact}`
      : '(No hay catálogo cargado. Responde que no hay datos disponibles.)';

    const relevantSection = relevantBlock ? `\n\n${relevantBlock}` : '';

    return `Eres el asistente de ISUZU Cotizador (México). Tu ÚNICA fuente de información es el catálogo que aparece abajo. NO uses tu conocimiento previo.

REGLAS ESTRICTAS (OBLIGATORIAS):
1. SOLO responde con datos que aparecen explícitamente en los bloques "ÚNICA FUENTE DE DATOS" y "Modelos más relevantes" abajo.
2. Si un modelo, precio, especificación o dato NO está en esos bloques, di: "Ese dato no está en nuestro catálogo actual. Te sugiero revisar el Catálogo en la app o contactar a un concesionario Isuzu México."
3. PROHIBIDO usar información de Colombia, otros países o tu entrenamiento sobre Isuzu. Ignora completamente cualquier dato que conozcas de fuentes externas.
4. Los únicos modelos que existen para ti son los listados abajo. Cualquier otro nombre de modelo = no disponible.

Objetivo: ayudar a elegir según capacidad de carga, presupuesto, giro (reparto, refrigerado, etc.) y eficiencia. Siempre citando SOLO lo que aparece en el catálogo.${contextSection ? ' Con el contexto del cliente, da recomendaciones específicas con argumentos (distribución de tarimas, tipo de camión, capacidad).' : ''}

Estilo: español (México), profesional, breve. Si no hay dato, dilo claramente.

Resumen:
${this.catalogSummary}

${compactSection}
${relevantSection}

(Recuerda: solo datos de arriba. Cero invención. Cero Colombia.)`;
  }

  async completeChat(history: ChatMessage[], clientContext?: string): Promise<string> {
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
    const relevant = this.pickRelevantModels(lastUser + (clientContext || ''));
    const relevantBlock = this.formatRelevantBlock(relevant);

    const messages = [
      { role: 'system' as const, content: this.systemPrompt(relevantBlock, clientContext) },
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
        temperature: 0.2,
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
