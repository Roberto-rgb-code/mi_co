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
  modelosIsuzu: Modelo[];
  resumenCompetidor: ComparativaResumenCompetidor;
  filas: ComparativaFila[];
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
Responde SOLO un JSON válido con esta forma exacta (sin markdown):
{
  "modelos_catalogo": ["string"],
  "intro": "2-4 frases en español (México): por qué estos ISUZU son alternativas razonables frente al competidor.",
  "resumen_competidor": {
    "nombre": "cómo identificas el vehículo competidor",
    "precio": "estimación o N/D si no hay dato público confiable",
    "capacidad_carga": "texto corto o N/D",
    "pvb": "texto o N/D",
    "motor": "texto o N/D",
    "hp_torque": "texto o N/D",
    "rendimiento": "km/L u otro dato público o N/D",
    "dimensiones_aplicacion": "dimensiones de caja/cargo si las conoces, o N/D",
    "garantia": "texto o N/D",
    "tecnologia": "Euro, etc. o N/D"
  }
}
No inventes precios exactos del competidor: si no estás seguro, pon "N/D" o "orientativo (verificar con distribuidor)".`;

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
        max_tokens: 1200,
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

    return {
      intro,
      modelosIsuzu: seleccion,
      resumenCompetidor: resumen,
      filas,
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
