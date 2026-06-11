import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

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
  items: CubicajeAsistenteItem[];
}

const TIPOS_VALIDOS = new Set<CubicajeAsistenteTipo>(['pequena', 'mediana', 'grande', 'tarima', 'tambo']);

const PRESETS = `
Tipos de mercancía (campo "tipo"):
- pequena: caja pequeña (default 0.3×0.2×0.15 m, 15 kg)
- mediana: caja mediana (default 0.5×0.4×0.3 m, 35 kg)
- grande: caja grande (default 0.75×0.5×0.6 m, 80 kg)
- tarima: tarima/pallet (default 1.2×1×1.5 m, 700 kg)
- tambo: tambo/cilindro/drum (default Ø0.58 m × 0.87 m alto, 200 kg). Para tambo usa largo=ancho=diámetro en metros.

Medidas siempre en METROS. Peso en kg por unidad.
Si el usuario da cm, convierte a metros (ej. 120 cm → 1.2 m).
`.trim();

@Injectable()
export class CubicajeAssistantService {
  private readonly logger = new Logger(CubicajeAssistantService.name);

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
    const modelos = (input.modelosDisponibles || []).slice(0, 80);
    const modelosBlock =
      modelos.length > 0
        ? `Camiones ISUZU disponibles (usa el nombre exacto en "modelo" si recomiendas uno):\n${modelos.join('\n')}`
        : 'No se envió lista de camiones; deja "modelo" vacío si no hay recomendación.';

    const contextBlock = input.clientContext?.trim()
      ? `\nContexto del cliente CRM:\n${input.clientContext.trim().slice(0, 1500)}`
      : '';

    const truckBlock = input.modeloActual?.trim()
      ? `\nCamión seleccionado actualmente en la UI: ${input.modeloActual.trim()}`
      : '';

    const system = `Eres el asistente de cubicaje 3D de ISUZU México. El usuario describe mercancía en lenguaje natural y tú configuras la carga para simular colocación en el camión.

${PRESETS}

${modelosBlock}${truckBlock}${contextBlock}

Responde SIEMPRE con un JSON válido (sin markdown) con esta forma:
{
  "reply": "mensaje breve en español explicando qué configuraste o pidiendo aclaración",
  "aplicar": true si pudiste interpretar cantidades/tipos de mercancía; false si solo es pregunta o falta info crítica,
  "autoCalcular": true si aplicar=true y hay al menos un ítem con cantidad>0 (simular de inmediato),
  "modelo": "nombre exacto del camión recomendado o null",
  "items": [
    { "tipo": "tarima", "cantidad": 8, "largo": 1.2, "ancho": 1, "alto": 1.5, "pesoKg": 700, "etiqueta": "Aceite" }
  ]
}

Reglas:
- "items" solo incluye tipos con cantidad > 0. Omite medidas/peso si el usuario no los dio (el frontend usará defaults).
- Si mezcla varios tipos, devuelve varios objetos en items.
- etiqueta: nombre corto del producto si el usuario lo menciona; si no, cadena vacía "".
- Si el usuario pide modificar ("agrega 4 tambos"), devuelve la carga COMPLETA resultante, no solo el delta.
- reply amigable, máximo 3 oraciones.`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
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
      modelo?: string | null;
      items?: unknown[];
    };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new ServiceUnavailableException('Respuesta inválida del modelo.');
    }

    const items = this.sanitizeItems(parsed.items);
    const aplicar = Boolean(parsed.aplicar) && items.some((i) => i.cantidad > 0);
    const reply =
      typeof parsed.reply === 'string' && parsed.reply.trim()
        ? parsed.reply.trim().slice(0, 2000)
        : aplicar
          ? 'Listo, configuré la carga según tu descripción.'
          : 'Cuéntame qué mercancía, cantidades, medidas y peso quieres cargar.';

    return {
      reply,
      aplicar,
      autoCalcular: aplicar && parsed.autoCalcular !== false,
      modelo: typeof parsed.modelo === 'string' && parsed.modelo.trim() ? parsed.modelo.trim().slice(0, 120) : undefined,
      items: aplicar ? items : [],
    };
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
      const item: CubicajeAsistenteItem = { tipo, cantidad };
      const largo = this.clampDim(r.largo);
      const ancho = this.clampDim(r.ancho);
      const alto = this.clampDim(r.alto);
      if (largo != null) item.largo = largo;
      if (ancho != null) item.ancho = ancho;
      if (alto != null) item.alto = alto;
      if (tipo === 'tambo' && largo != null && ancho == null) item.ancho = largo;
      const pesoKg = this.clampInt(r.pesoKg, 1, 50000);
      if (pesoKg != null) item.pesoKg = pesoKg;
      if (typeof r.etiqueta === 'string') item.etiqueta = r.etiqueta.trim().slice(0, 40);
      out.push(item);
    }
    return out;
  }

  private clampDim(v: unknown): number | null {
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    if (!Number.isFinite(n) || n < 0.05 || n > 15) return null;
    return Math.round(n * 1000) / 1000;
  }

  private clampInt(v: unknown, min: number, max: number): number | null {
    const n = typeof v === 'number' ? v : parseInt(String(v), 10);
    if (!Number.isFinite(n)) return null;
    return Math.min(max, Math.max(min, Math.round(n)));
  }
}
