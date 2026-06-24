import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { CubicajeService, type BultoInput } from './cubicaje.service';
import {
  enrichItemsFromUserText,
  formatItemDims,
  normalizeItemDims,
  STANDARD_SPECS,
  toMeters,
} from './cubicaje-measures';

const DEFAULT_MODEL = 'gpt-4o-mini';

export type CubicajeChatRole = 'user' | 'assistant';

export interface CubicajeChatMessage {
  role: CubicajeChatRole;
  content: string;
}

export type CubicajeAsistenteTipo = 'pequena' | 'mediana' | 'grande' | 'tarima' | 'tambo';

export interface CubicajeAsistenteItem {
  tipo: CubicajeAsistenteTipo;
  cantidad: number;
  largo?: number;
  ancho?: number;
  alto?: number;
  pesoKg?: number;
  etiqueta?: string;
}

export interface CubicajeAsistenteInput {
  messages: CubicajeChatMessage[];
  modeloActual?: string;
  modelosDisponibles?: string[];
  clientContext?: string;
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

const TIPO_COLORS: Record<CubicajeAsistenteTipo, string> = {
  pequena: '#22c55e',
  mediana: '#3b82f6',
  grande: '#f97316',
  tarima: '#c8102e',
  tambo: '#0891b2',
};

const TIPO_LABELS: Record<CubicajeAsistenteTipo, string> = {
  pequena: 'Caja pequeña',
  mediana: 'Caja mediana',
  grande: 'Caja grande',
  tarima: 'Tarima',
  tambo: 'Tambo',
};

const TIPOS_VALIDOS = new Set<CubicajeAsistenteTipo>(['pequena', 'mediana', 'grande', 'tarima', 'tambo']);

const ITEM_PRESETS = STANDARD_SPECS;

const PRESETS = `
Tipos de mercancía (campo "tipo"):
- pequena: caja pequeña (default 0.3×0.2×0.15 m, 15 kg)
- mediana: caja mediana (default 0.5×0.4×0.3 m, 35 kg)
- grande: caja grande (default 0.75×0.5×0.6 m, 80 kg)
- tarima: tarima/pallet (default 1.2×1×1.5 m, 700 kg)
- tambo: tambo/cilindro industrial 200 L → largo=ancho=0.585 m, alto=0.88 m, 200 kg
- tambo 100 L → Ø0.49 m, alto 0.88 m | tambo 50 L → Ø0.39 m, alto 0.75 m

Medidas SIEMPRE en METROS en el JSON (0.585, no 585 ni 58.5).
Peso en kg por UNIDAD (no peso total).
Si el usuario da cm: 58.5 cm → 0.585 m; 120 cm → 1.2 m.
Si dice "200 litros" o "tambo estándar": largo=0.585, ancho=0.585, alto=0.88.
Si dice "220 kg cada uno" o "220 kg por tambo": pesoKg=220.
Si dice peso total de N kg con X unidades: pesoKg = N/X.
`.trim();

@Injectable()
export class CubicajeAssistantService {
  private readonly logger = new Logger(CubicajeAssistantService.name);

  constructor(private readonly cubicaje: CubicajeService) {}

  async parseCarga(input: CubicajeAsistenteInput): Promise<CubicajeAsistenteResponse> {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY no está configurada. Añádela en Railway o en el .env del proyecto.',
      );
    }

    const trimmed = (input.messages || [])
      .filter((m) => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }))
      .slice(-16);

    if (!trimmed.some((m) => m.role === 'user')) {
      throw new BadRequestException('Envía al menos un mensaje del usuario.');
    }

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

    const contextBlock = input.clientContext?.trim()
      ? `\nContexto del cliente CRM:\n${input.clientContext.trim().slice(0, 1500)}`
      : '';

    const truckBlock = input.modeloActual?.trim()
      ? `\nCamión seleccionado en la UI (NO lo recomiendes automáticamente; el sistema elegirá el más adecuado): ${input.modeloActual.trim()}`
      : '';

    const system = `Eres el asistente de cubicaje 3D de ISUZU México. Interpretas la mercancía que el usuario quiere cargar.

${PRESETS}
${truckBlock}${contextBlock}

Responde SIEMPRE con JSON válido (sin markdown):
{
  "reply": "mensaje breve en español (sin nombrar camión; el sistema lo calcula)",
  "aplicar": true si interpretaste cantidades/tipos; false si falta info,
  "autoCalcular": true si aplicar=true y hay ítems con cantidad>0,
  "modelo": null,
  "items": [
    { "tipo": "tambo", "cantidad": 6, "largo": 0.585, "ancho": 0.585, "alto": 0.88, "pesoKg": 220, "etiqueta": "Aceite" }
  ]
}

Reglas:
- "modelo" SIEMPRE null (el backend elige el camión más pequeño del catálogo que quepa).
- items: solo tipos con cantidad>0. Carga completa en cada respuesta, no solo deltas.
- etiqueta: producto si lo menciona; si no "".
- pesoKg: por unidad, no total.
- reply: máximo 2 oraciones, confirma qué configuraste.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.1,
        max_tokens: 1200,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          ...trimmed.map((m) => ({ role: m.role, content: m.content })),
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`OpenAI cubicaje ${res.status}: ${errText.slice(0, 400)}`);
      throw new ServiceUnavailableException('No se pudo contactar al asistente de cubicaje.');
    }

    const body = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new ServiceUnavailableException('Respuesta vacía del modelo.');

    let parsed: {
      reply?: string;
      aplicar?: boolean;
      autoCalcular?: boolean;
      items?: unknown[];
    };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new ServiceUnavailableException('Respuesta inválida del modelo.');
    }

    const lastUser = [...trimmed].reverse().find((m) => m.role === 'user')?.content ?? '';
    let items = this.sanitizeItems(parsed.items);
    items = enrichItemsFromUserText(items, lastUser);
    const aplicar = Boolean(parsed.aplicar) && items.some((i) => i.cantidad > 0);

    let modelo: string | undefined;
    let utilizacionPct: number | undefined;
    let pesoTotalKg: number | undefined;
    let reply =
      typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 2000)
        : aplicar
          ? 'Listo, configuré la carga según tu descripción.'
          : 'Cuéntame qué mercancía, cantidades, medidas y peso quieres cargar.';

    if (aplicar) {
      const bultos = this.itemsToBultos(items);
      const fit = this.cubicaje.findSmallestFittingModelo(bultos);
      if (fit) {
        modelo = fit.modelo;
        utilizacionPct = fit.utilizacionVolumen;
        pesoTotalKg = fit.pesoColocadoKg;
        reply = this.buildReplyWithTruck(items, fit, reply);
      } else {
        reply += ' No encontré un camión del catálogo donde quepa toda la carga; prueba reducir cantidad o revisa medidas.';
      }
    }

    return {
      reply,
      aplicar,
      autoCalcular: aplicar && parsed.autoCalcular !== false,
      modelo,
      utilizacionPct,
      pesoTotalKg,
      items: aplicar ? items : [],
    };
  }

  private buildReplyWithTruck(
    items: CubicajeAsistenteItem[],
    fit: { modelo: string; utilizacionVolumen: number; pesoColocadoKg: number },
    llmReply: string,
  ): string {
    const parts = items.map((i) => {
      const name = i.etiqueta?.trim() || TIPO_LABELS[i.tipo];
      const dims = formatItemDims(i);
      const kg = i.pesoKg ?? ITEM_PRESETS[i.tipo].pesoKg;
      return `${i.cantidad}× ${name} (${dims}, ${kg} kg/u)`;
    });
    return (
      `${llmReply} Camión recomendado: **${fit.modelo}** ` +
      `(~${fit.utilizacionVolumen}% volumen, ${Math.round(fit.pesoColocadoKg).toLocaleString('es-MX')} kg total). ` +
      `Carga: ${parts.join('; ')}.`
    ).slice(0, 2000);
  }

  itemsToBultos(items: CubicajeAsistenteItem[]): BultoInput[] {
    return items.map((item) => {
      const normalized = normalizeItemDims(item);
      const p = ITEM_PRESETS[normalized.tipo];
      const label = normalized.etiqueta?.trim() || TIPO_LABELS[normalized.tipo];
      return {
        id: normalized.tipo,
        label,
        tipo: normalized.tipo,
        largo: normalized.largo ?? p.largo,
        ancho: normalized.ancho ?? p.ancho,
        alto: normalized.alto ?? p.alto,
        cantidad: normalized.cantidad,
        color: TIPO_COLORS[normalized.tipo],
        pesoKg: normalized.pesoKg ?? p.pesoKg,
      };
    });
  }

  private sanitizeItems(raw: unknown): CubicajeAsistenteItem[] {
    if (!Array.isArray(raw)) return [];
    const out: CubicajeAsistenteItem[] = [];
    for (const row of raw) {
      if (!row || typeof row !== 'object') continue;
      const r = row as Record<string, unknown>;
      const tipo = String(r.tipo || '').trim() as CubicajeAsistenteTipo;
      if (!TIPOS_VALIDOS.has(tipo)) continue;
      const cantidad = this.clampInt(r.cantidad, 0, 999);
      if (cantidad == null || cantidad <= 0) continue;
      const preset = ITEM_PRESETS[tipo];
      const item: CubicajeAsistenteItem = { tipo, cantidad };
      const largo = this.clampDim(r.largo);
      const ancho = this.clampDim(r.ancho);
      const alto = this.clampDim(r.alto);
      if (largo != null) item.largo = largo;
      else if (tipo === 'tambo') item.largo = preset.largo;
      if (ancho != null) item.ancho = ancho;
      else if (tipo === 'tambo') item.ancho = item.largo ?? preset.ancho;
      if (alto != null) item.alto = alto;
      else if (tipo === 'tambo') item.alto = preset.alto;
      const pesoKg = this.clampInt(r.pesoKg, 1, 50000);
      if (pesoKg != null) item.pesoKg = pesoKg;
      if (typeof r.etiqueta === 'string') item.etiqueta = r.etiqueta.trim().slice(0, 40);
      out.push(normalizeItemDims(item));
    }
    return out;
  }

  private clampDim(v: unknown): number | null {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!Number.isFinite(n) || n <= 0) return null;
    const m = Math.round(toMeters(n) * 1000) / 1000;
    if (m < 0.05 || m > 15) return null;
    return m;
  }

  private clampInt(v: unknown, min: number, max: number): number | null {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.round(n)));
  }
}
