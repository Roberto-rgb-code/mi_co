import { useState, useEffect } from 'react';
import './Cotizador.css';

interface Modelo {
  modelo: string;
  linea?: string;
  precio?: number;
  precio_2026?: number;
  capacidad_carga?: string;
  km_litro?: string;
}

export function Cotizador() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Modelo | null>(null);

  useEffect(() => {
    fetch('/catalog_data.json')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => {
        const obj = data.modelos || {};
        const list = Object.entries(obj).map(([key, val]) => ({
          ...(val as Modelo),
          modelo: (val as Modelo).modelo || key,
        }));
        setModelos(list);
      })
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (n: string) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(parseFloat(n || '0'));

  return (
    <div className="page cotizador">
      <div className="page-header">
        <h1>Cotizador</h1>
        <p>Selecciona un modelo para generar tu cotización</p>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando catálogo...</p>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && modelos.length === 0 && (
        <div className="empty-state">
          <p>No hay modelos en catálogo.</p>
        </div>
      )}

      {!loading && !error && modelos.length > 0 && (
        <div className="cotizador-layout">
          <div className="modelos-grid">
            {modelos.map(m => (
              <article
                key={m.modelo}
                className={`card ${selected?.modelo === m.modelo ? 'selected' : ''}`}
                onClick={() => setSelected(m)}
              >
                <div className="card-badge">{m.linea || 'ISUZU'}</div>
                <h3>{m.modelo}</h3>
                <p className="capacity">{m.capacidad_carga || '-'}</p>
                <p className="price">{formatPrice(String(m.precio ?? m.precio_2026 ?? 0))}</p>
                {m.km_litro && <p className="km">{m.km_litro}</p>}
              </article>
            ))}
          </div>

          {selected && (
            <aside className="quote-summary">
              <h3>Resumen de cotización</h3>
              <div className="quote-detail">
<strong>{selected.modelo}</strong>
              <p>{selected.capacidad_carga}</p>
              <p className="precio-final">{formatPrice(String(selected.precio ?? selected.precio_2026 ?? 0))}</p>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
