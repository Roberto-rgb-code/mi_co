import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ModelosService } from '../modelos/modelos.service';
import type { Modelo } from '../entities/modelo.entity';

const DEFAULT_MODEL = 'gpt-4o-mini';

export type ComparativaResumenCompetidor = {
  nombre: string;
  precio: string;
  capacidad_carga: string;
  pvb: string;
  motor: string;
  hp_torque: string;
  rendimiento: string;
  dimensiones_aplicacion: string;
  garantia: string;
  tecnologia: string;
};

export type ComparativaFila = {
  criterio: string;
  competidor: string;
  isuzu: Record<string, string>;
};

export type ComparativaResponse = {
  intro: string;
  /** Párrafo(s) con características del competidor; orientativo, no ficha oficial. */
  fichaCompetidor: string;
  modelosIsuzu: Modelo[];
  resumenCompetidor: ComparativaResumenCompetidor;
  filas: ComparativaFila[];
  /** Por qué ISUZU destaca frente a ese competidor (ventas, sin inventar precios ISUZU). */
  conclusionIsuzu: string;
};

@Injectable()
export class ComparativaService {
  private readonly logger = new Logger(ComparativaService.name);

  constructor(private readonly modelos: ModelosService) {}

  async comparar(competidor: string): Promise<ComparativaResponse> {
    const texto = competidor?.trim();
    if (!texto || texto.length < 3) {
      throw new BadRequestException('Describe el camión de la competencia (marca, modelo o tonelaje).');
    }
    if (texto.length > 4000) {
      throw new BadRequestException('Texto demasiado largo (máx. 4000 caracteres).');
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      throw new ServiceUnavailableException(
        'OPENAI_API_KEY no está configurada en el servidor.',
      );
    }

    const todos = await this.modelos.findAll();
    if (!todos.length) {
      throw new ServiceUnavailableException('No hay modelos ISUZU en la base de datos.');
    }

    const catalogosValidos = new Set(todos.map((m) => m.catalogo));
    const compacto = todos.map((m) => ({
      catalogo: m.catalogo,
      familia: m.familia,
      precio: Number(m.precio),
      capacidadCarga: m.capacidadCarga ?? null,
      pvb: m.pvb ?? null,
    }));

    const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
    const system = `Eres un asesor comercial de ISUZU México. El usuario indicará un camión de la competencia (otra marca).
Debes elegir de 1 a 3 modelos ISUZU del catálogo proporcionado que mejor se comparen por segmento, tonelaje y uso.
IMPORTANTE: en "modelos_catalogo" solo puedes usar valores de "catalogo" que existan EXACTAMENTE en el JSON "disponibles" (misma ortografía y espacios).

COMPETIDOR — completa bien "resumen_competidor" y "ficha_competidor":
- Si el usuario nombra un modelo concreto (ej. Hyundai Mighty QT500, Mercedes Atego, Hino 300, Freightliner, etc.), usa conocimiento general de especificaciones típicas de ese modelo o familia en camión mediano/liviano (México o mercados equivalentes). Da rangos o valores típicos y añade "(orientativo)" cuando sea estimación.
- Evita dejar "N/D" en cascada: solo úsalo si realmente no hay base para estimar. Para PVB, motor, hp/torque, km/L y dimensiones, prioriza un rango razonable del segmento.
- Precio competidor: nunca un número exacto inventado; usa "desde ~X MXN (orientativo)", "rango aproximado … (orientativo)" o "N/D" si no hay referencia.
- "ficha_competidor": 4-8 frases en español (México) resumiendo motor, segmento, uso típico, fortalezas percibidas del competidor y limitaciones comunes; todo como información orientativa.

CONCLUSIÓN ISUZU — "conclusion_isuzu":
- 180-450 palabras en español (México). Puede usar saltos de línea y líneas que empiecen con "- " para viñetas.
- Explica por qué ISUZU destaca frente a ESE competidor: durabilidad, costo total de operación, red de servicio, respaldo de marca, tecnología de los modelos elegidos (sin inventar precios ISUZU: los precios vienen del catálogo en el sistema).
- Tono profesional, no denigrar al competidor; argumentar con valor.

Responde SOLO un JSON válido con esta forma exacta (sin markdown):
{
  "modelos_catalogo": ["string"],
  "intro": "2-4 frases: contexto de la comparación.",
  "ficha_competidor": "string",
  "resumen_competidor": {
    "nombre": "identificación del vehículo competidor",
    "precio": "texto orientativo o N/D",
    "capacidad_carga": "texto",
    "pvb": "texto orientativo",
    "motor": "texto orientativo",
    "hp_torque": "texto orientativo",
    "rendimiento": "texto orientativo",
    "dimensiones_aplicacion": "texto orientativo",
    "garantia": "texto orientativo",
    "tecnologia": "texto orientativo"
  },
  "conclusion_isuzu": "string"
}`;

    const user = `Camión de la competencia (texto libre):\n"""${texto}"""\n\nModelos ISUZU disponibles (elige solo "catalogo" de esta lista):\n${JSON.stringify(compacto, null, 0)}`;

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 2800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      this.logger.error(`OpenAI comparativa ${res.status}: ${errText.slice(0, 400)}`);
      throw new ServiceUnavailableException('No se pudo generar la comparativa.');
    }

    const body = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const raw = body.choices?.[0]?.message?.content?.trim();
    if (!raw) {
      throw new ServiceUnavailableException('Respuesta vacía del modelo.');
    }

    let parsed: {
      modelos_catalogo?: string[];
      intro?: string;
      ficha_competidor?: string;
      conclusion_isuzu?: string;
      resumen_competidor?: Partial<ComparativaResumenCompetidor>;
    };
    try {
      parsed = JSON.parse(raw) as typeof parsed;
    } catch {
      throw new ServiceUnavailableException('Respuesta inválida del modelo.');
    }

    const elegidos = (parsed.modelos_catalogo || [])
      .filter((c) => catalogosValidos.has(c))
      .slice(0, 3);

    const seleccion =
      elegidos.length > 0
        ? todos.filter((m) => elegidos.includes(m.catalogo))
        : [todos[0], todos[1]].filter(Boolean).slice(0, 2);

    const rc = parsed.resumen_competidor || {};
    const resumen: ComparativaResumenCompetidor = {
      nombre: String(rc.nombre || texto.slice(0, 120)),
      precio: String(rc.precio || 'N/D'),
      capacidad_carga: String(rc.capacidad_carga || 'N/D'),
      pvb: String(rc.pvb || 'N/D'),
      motor: String(rc.motor || 'N/D'),
      hp_torque: String(rc.hp_torque || 'N/D'),
      rendimiento: String(rc.rendimiento || 'N/D'),
      dimensiones_aplicacion: String(rc.dimensiones_aplicacion || 'N/D'),
      garantia: String(rc.garantia || 'N/D'),
      tecnologia: String(rc.tecnologia || 'N/D'),
    };

    const filas = this.buildFilas(seleccion, resumen);
    const intro =
      String(parsed.intro || '').trim() ||
      `Comparativa orientativa entre el vehículo indicado y ${seleccion.map((m) => m.catalogo).join(', ')} del catálogo ISUZU México.`;

    const fichaCompetidor =
      String(parsed.ficha_competidor || '').trim() ||
      `Características del competidor (${resumen.nombre}): datos orientativos según el segmento; confirma especificaciones con el distribuidor de la marca.`;

    const catalogosStr = seleccion.map((m) => m.catalogo).join(', ');
    const conclusionIsuzu =
      String(parsed.conclusion_isuzu || '').trim() ||
      `ISUZU ofrece en ${catalogosStr} alternativas alineadas al segmento, con respaldo de red de servicio y especificaciones verificables en este catálogo. Contrasta el costo total de operación y la garantía frente al competidor indicado, validando siempre en concesionario.`;

    return {
      intro,
      fichaCompetidor,
      modelosIsuzu: seleccion,
      resumenCompetidor: resumen,
      filas,
      conclusionIsuzu,
    };
  }

  private fmtMoney(n: number): string {
    return new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(
      n,
    );
  }

  private fmtDim(m: Modelo): string {
    const L = m.largoAplicacion != null ? `${Number(m.largoAplicacion)} m` : '—';
    const W = m.anchoAplicacion != null ? `${Number(m.anchoAplicacion)} m` : '—';
    const H = m.altoAplicacion != null ? `${Number(m.altoAplicacion)} m` : '—';
    if (L === '—' && W === '—' && H === '—') return '—';
    return `${L} × ${W} × ${H}`;
  }

  private buildFilas(modelos: Modelo[], comp: ComparativaResumenCompetidor): ComparativaFila[] {
    const isuzu = (fn: (m: Modelo) => string) =>
      Object.fromEntries(modelos.map((m) => [m.catalogo, fn(m)]));

    return [
      {
        criterio: 'Precio lista (referencia)',
        competidor: comp.precio,
        isuzu: isuzu((m) => this.fmtMoney(Number(m.precio))),
      },
      {
        criterio: 'Capacidad de carga',
        competidor: comp.capacidad_carga,
        isuzu: isuzu((m) => m.capacidadCarga || '—'),
      },
      {
        criterio: 'PVB / peso bruto',
        competidor: comp.pvb,
        isuzu: isuzu((m) => m.pvb || '—'),
      },
      {
        criterio: 'Motor',
        competidor: comp.motor,
        isuzu: isuzu((m) => (m.motor || '—').replace(/\s+/g, ' ').slice(0, 200)),
      },
      {
        criterio: 'Potencia / torque',
        competidor: comp.hp_torque,
        isuzu: isuzu((m) => {
          const hp = m.hp || '—';
          const tq = m.torque || '—';
          return hp !== '—' || tq !== '—' ? `${hp} / ${tq}` : '—';
        }),
      },
      {
        criterio: 'Rendimiento',
        competidor: comp.rendimiento,
        isuzu: isuzu((m) => m.kmPorLitro || '—'),
      },
      {
        criterio: 'Dimensiones aplicación (largo × ancho × alto)',
        competidor: comp.dimensiones_aplicacion,
        isuzu: isuzu((m) => this.fmtDim(m)),
      },
      {
        criterio: 'Garantía',
        competidor: comp.garantia,
        isuzu: isuzu((m) => m.garantia || '—'),
      },
      {
        criterio: 'Tecnología / emisiones',
        competidor: comp.tecnologia,
        isuzu: isuzu((m) => m.tecnologia || '—'),
      },
    ];
  }
}
