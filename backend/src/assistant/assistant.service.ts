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

@Injectable()
export class AssistantService implements OnModuleInit {
  private readonly logger = new Logger(AssistantService.name);
  private catalogContext = '';

  onModuleInit() {
    this.catalogContext = this.buildCatalogContext();
  }

  /** Contexto breve desde catalog_data.json (dist o public) para orientar al modelo. */
  private buildCatalogContext(): string {
    const candidates = [
      join(__dirname, '..', '..', 'frontend', 'dist', 'catalog_data.json'),
      join(__dirname, '..', '..', 'frontend', 'public', 'catalog_data.json'),
    ];
    for (const p of candidates) {
      if (!existsSync(p)) continue;
      try {
        const raw = readFileSync(p, 'utf-8');
        const data = JSON.parse(raw) as { modelos?: Record<string, { precio?: number; precio_2026?: number; linea?: string; capacidad_carga?: string }> };
        const modelos = data.modelos || {};
        const keys = Object.keys(modelos);
        if (keys.length === 0) continue;
        const precios: number[] = [];
        const lineas = new Set<string>();
        for (const k of keys) {
          const m = modelos[k];
          const pr = typeof m?.precio === 'number' ? m.precio : m?.precio_2026;
          if (typeof pr === 'number' && !Number.isNaN(pr)) precios.push(pr);
          if (m?.linea) lineas.add(String(m.linea));
        }
        const minP = precios.length ? Math.min(...precios) : null;
        const maxP = precios.length ? Math.max(...precios) : null;
        const fmt = (n: number) =>
          new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(n);
        return [
          `Catálogo cargado: ${keys.length} modelos.`,
          lineas.size ? `Líneas: ${[...lineas].join(', ')}.` : '',
          minP != null && maxP != null
            ? `Rango orientativo de precio de lista (MXN): ${fmt(minP)} – ${fmt(maxP)}.`
            : '',
          'ELF suele cubrir cargas ligeras/medias; Forward cargas mayores. Los valores exactos dependen del modelo y año — remite siempre a revisar Cotizador y Catálogo en la app.',
        ]
          .filter(Boolean)
          .join(' ');
      } catch (e) {
        this.logger.warn(`No se pudo leer catálogo en ${p}: ${e}`);
      }
    }
    return 'No hay resumen de catálogo en disco; orienta con conocimiento general de líneas ELF (carga ligera/media) y Forward (mayor tonelaje) y pide al usuario usar el Cotizador y Catálogo para precios exactos.';
  }

  private systemPrompt(): string {
    return `Eres el asistente virtual de ISUZU Cotizador (México) para clientes que buscan camión de carga.

Tu objetivo: ayudar a elegir o acotar opciones según:
- Peso o capacidad de carga necesaria (toneladas).
- Presupuesto o rango de precio (lista / aproximado).
- Giro o tipo de uso: reparto urbano, refrigerados, construcción, materiales, mudanza, paquetería, etc.
- Distancia, terreno, necesidad de eficiencia (km/L).

Reglas:
- Responde siempre en español (México), tono profesional y claro.
- Haz preguntas concretas si faltan datos (peso, ruta, presupuesto, ciudad, tipo de caja).
- No inventes precios exactos de un modelo concreto salvo que el usuario te los haya dado o coincidan con el contexto numérico siguiente.
- Si piden cifra exacta de un modelo, indica que deben ver el módulo Cotizador o Catálogo de la aplicación.
- No prometas disponibilidad, entrega ni condiciones comerciales finales: remite a un asesor humano / distribuidor.
- Sé breve en listas; usa viñetas cuando ayude.

Contexto numérico del catálogo actual (orientativo):
${this.catalogContext}`;
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

    const messages = [
      { role: 'system' as const, content: this.systemPrompt() },
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
        temperature: 0.65,
        max_tokens: 900,
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
