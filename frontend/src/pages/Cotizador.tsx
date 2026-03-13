import { useState, useEffect } from 'react';
import './Cotizador.css';

interface Modelo {
  id: string;
  catalogo: string;
  familia: string;
  precio: string;
  capacidadCarga: string;
  kmPorLitro: string;
}

export function Cotizador() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Modelo | null>(null);

  useEffect(() => {
    fetch('/api/modelos')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => setModelos(data))
      .catch(() => setError('No se pudo conectar con el servidor.'))
      .finally(() => setLoading(false));
  }, []);

  const formatPrice = (n: string) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(n || '0'));

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
                key={m.id}
                className={`card ${selected?.id === m.id ? 'selected' : ''}`}
                onClick={() => setSelected(m)}
              >
                <div className="card-badge">{m.familia}</div>
                <h3>{m.catalogo}</h3>
                <p className="capacity">{m.capacidadCarga || '-'}</p>
                <p className="price">{formatPrice(m.precio)}</p>
                {m.kmPorLitro && <p className="km">{m.kmPorLitro}</p>}
              </article>
            ))}
          </div>

          {selected && (
            <aside className="quote-summary">
              <h3>Resumen de cotización</h3>
              <div className="quote-detail">
                <strong>{selected.catalogo}</strong>
                <p>{selected.capacidadCarga}</p>
                <p className="precio-final">{formatPrice(selected.precio)}</p>
              </div>
            </aside>
          )}
        </div>
      )}
    </div>
  );
}
