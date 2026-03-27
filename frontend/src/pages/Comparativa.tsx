import { useState } from 'react';
import { Link } from 'react-router-dom';
import './Comparativa.css';

type ComparativaFila = {
  criterio: string;
  competidor: string;
  isuzu: Record<string, string>;
};

type ModeloResp = {
  id: string;
  catalogo: string;
  familia: string;
  precio: number;
};

type ComparativaData = {
  intro: string;
  fichaCompetidor: string;
  modelosIsuzu: ModeloResp[];
  resumenCompetidor: {
    nombre: string;
  };
  filas: ComparativaFila[];
  conclusionIsuzu: string;
};

export function Comparativa() {
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ComparativaData | null>(null);

  async function comparar() {
    const t = input.trim();
    if (!t || loading) return;
    setError(null);
    setData(null);
    setLoading(true);
    try {
      const res = await fetch('/api/comparativa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ competidor: t }),
      });
      const json = (await res.json().catch(() => ({}))) as ComparativaData & { message?: string; statusCode?: number };
      if (!res.ok) {
        throw new Error(
          typeof json.message === 'string' ? json.message : 'No se pudo generar la comparativa.',
        );
      }
      setData(json as ComparativaData);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error de red');
    } finally {
      setLoading(false);
    }
  }

  const columnas = data?.modelosIsuzu.map((m) => m.catalogo) ?? [];

  return (
    <div className="page comparativa">
      <div className="comparativa-header">
        <h1>Comparativa</h1>
        <p className="comparativa-sub">
          Indica un <strong>camión de otra marca</strong> (modelo, tonelaje o uso). Te mostramos una comparativa con{' '}
          <strong>modelos ISUZU reales del catálogo</strong> en base de datos. Los datos del competidor son orientativos;
          los de ISUZU provienen del sistema.
        </p>
      </div>

      <div className="comparativa-form">
        <label htmlFor="comp-input" className="sr-only">
          Camión de la competencia
        </label>
        <textarea
          id="comp-input"
          className="comparativa-textarea"
          rows={4}
          placeholder="Ej.: Mercedes Atego 1018 4x2 para reparto urbano de 8-10 toneladas, o Hino 300 Series caja seca..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={loading}
        />
        <div className="comparativa-actions">
          <button type="button" className="btn-comparar" onClick={comparar} disabled={loading || !input.trim()}>
            {loading ? 'Generando…' : 'Comparar con ISUZU'}
          </button>
          <Link to="/catalogo" className="comparativa-link-catalogo">
            Ver catálogo ISUZU
          </Link>
        </div>
        {error && <p className="comparativa-error">{error}</p>}
      </div>

      {data && (
        <div className="comparativa-result">
          <div className="comparativa-intro">
            <h2>Resultado</h2>
            <p>{data.intro}</p>
            <p className="comparativa-competidor-name">
              <span className="label">Competidor indicado:</span> {data.resumenCompetidor.nombre}
            </p>
          </div>

          {data.fichaCompetidor && (
            <section className="comparativa-ficha" aria-labelledby="ficha-comp-title">
              <h3 id="ficha-comp-title">Características del competidor (orientativo)</h3>
              <p className="comparativa-ficha-text">{data.fichaCompetidor}</p>
            </section>
          )}

          <div className="comparativa-table-wrap">
            <table className="comparativa-table">
              <thead>
                <tr>
                  <th className="col-criterio">Criterio</th>
                  <th className="col-comp">Competidor (orientativo)</th>
                  {columnas.map((c) => (
                    <th key={c} className="col-isuzu">
                      ISUZU {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.filas.map((f) => (
                  <tr key={f.criterio}>
                    <td className="col-criterio">{f.criterio}</td>
                    <td className="col-comp">{f.competidor}</td>
                    {columnas.map((c) => (
                      <td key={c}>{f.isuzu[c] ?? '—'}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <p className="comparativa-disclaimer">
            Los valores ISUZU corresponden al catálogo cargado en esta herramienta. La columna del competidor puede
            contener estimaciones o N/D; confirma siempre con el distribuidor de la marca correspondiente.
          </p>

          {data.conclusionIsuzu && (
            <section className="comparativa-conclusion" aria-labelledby="conclusion-isuzu-title">
              <h3 id="conclusion-isuzu-title">Conclusión: por qué destaca ISUZU</h3>
              <div className="comparativa-conclusion-text">{data.conclusionIsuzu}</div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
