import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import type { ModeloCatalog } from '../data/catalog';
import { ModeloCard } from '../components/ModeloCard';
import './Cotizador.css';

interface CatalogPayload {
  modelos: Record<string, ModeloCatalog>;
  fuentes?: { elf?: string | null; forward?: string | null; cubicaje?: string | null };
}

function sortModelosParaCotizador(list: ModeloCatalog[]): ModeloCatalog[] {
  return [...list].sort((a, b) => {
    const la = (a.linea || '').toUpperCase();
    const lb = (b.linea || '').toUpperCase();
    if (la === 'ELF' && lb !== 'ELF') return -1;
    if (la !== 'ELF' && lb === 'ELF') return 1;
    return a.modelo.localeCompare(b.modelo, 'es', { numeric: true });
  });
}

function formatPrice(n: number | undefined) {
  const v = typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    maximumFractionDigits: 0,
  }).format(v);
}

export function Cotizador() {
  const [modelos, setModelos] = useState<ModeloCatalog[]>([]);
  const [fuentes, setFuentes] = useState<CatalogPayload['fuentes']>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [lineaFilter, setLineaFilter] = useState<string>('todas');
  const [selected, setSelected] = useState<ModeloCatalog | null>(null);

  useEffect(() => {
    Promise.all([
      fetch('/catalog_data.json').then((r) => (r.ok ? r.json() : Promise.reject(r))),
      fetch('/model_images.json')
        .then((r) => r.json())
        .catch(() => ({})),
    ])
      .then(([data, images]: [CatalogPayload, Record<string, string>]) => {
        const obj = data.modelos || {};
        setFuentes(data.fuentes);
        const imageMap = images || {};
        const list = Object.entries(obj).map(([key, val]) => {
          const m = val as ModeloCatalog;
          const modelo = m.modelo || key;
          return { ...m, modelo, image: imageMap[modelo] };
        });
        const sorted = sortModelosParaCotizador(list);
        setModelos(sorted);
        if (sorted.length > 0) setSelected(sorted[0]);
      })
      .catch(() => setError('No se pudo cargar el catálogo. Revisa la conexión.'))
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    return modelos.filter((m) => {
      const q = filter.toLowerCase().trim();
      const matchSearch =
        !q ||
        m.modelo?.toLowerCase().includes(q) ||
        m.linea?.toLowerCase().includes(q) ||
        m.capacidad_carga?.toLowerCase().includes(q);
      const matchLinea = lineaFilter === 'todas' || m.linea === lineaFilter;
      return matchSearch && matchLinea;
    });
  }, [modelos, filter, lineaFilter]);

  useEffect(() => {
    if (filtered.length === 0) {
      setSelected(null);
      return;
    }
    if (!selected || !filtered.some((m) => m.modelo === selected.modelo)) {
      setSelected(filtered[0]);
    }
  }, [filtered, selected]);

  const precioLista = selected ? selected.precio ?? selected.precio_2026 : undefined;
  const motorResumen =
    selected?.motor?.split('/')[0]?.trim() || selected?.motor?.slice(0, 48) || '—';

  return (
    <div className="page cotizador">
      <div className="cotizador-header">
        <div>
          <h1>Cotizador</h1>
          <p className="cotizador-lead">
            Selecciona un modelo para ver el resumen. Precios sugeridos a la venta con IVA e ISAN
            (Plan Marzo 2026, ANEXO 1 TC 20.00). Fuente:{' '}
            <a href="https://www.isuzumex.com.mx/" target="_blank" rel="noopener noreferrer">
              isuzumex.com.mx
            </a>
            .
          </p>
        </div>
        {(fuentes?.precios_mexico || fuentes?.elf) && (
          <p className="cotizador-fuente" title="Origen de extracción">
            {fuentes.precios_mexico && <span>{fuentes.precios_mexico}</span>}
            {fuentes.elf && (
              <>
                {fuentes.precios_mexico && <br />}
                ELF: <span>{fuentes.elf}</span>
              </>
            )}
            {fuentes.forward && (
              <>
                <br />
                Forward: <span>{fuentes.forward}</span>
              </>
            )}
          </p>
        )}
      </div>

      <div className="cotizador-filters">
        <input
          type="search"
          className="cotizador-search"
          placeholder="Buscar por modelo, línea o capacidad…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          aria-label="Buscar modelos"
        />
        <select
          className="cotizador-linea"
          value={lineaFilter}
          onChange={(e) => setLineaFilter(e.target.value)}
          aria-label="Filtrar por línea"
        >
          <option value="todas">Todas las líneas</option>
          <option value="ELF">ELF</option>
          <option value="Forward">Forward</option>
        </select>
      </div>

      {loading && (
        <div className="loading">
          <div className="spinner" />
          <p>Cargando modelos…</p>
        </div>
      )}

      {error && (
        <div className="error-banner">
          <p>{error}</p>
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="empty-state">
          <p>No hay modelos que coincidan. Prueba otro filtro.</p>
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="cotizador-layout">
          <div className="cotizador-grid-wrap">
            <div className="modelos-grid modelos-grid--cotizador">
              {filtered.map((m) => (
                <ModeloCard
                  key={m.modelo}
                  modelo={m}
                  variant="cotizador"
                  selected={selected?.modelo === m.modelo}
                  onClick={() => setSelected(m)}
                />
              ))}
            </div>
          </div>

          <aside className="quote-summary" aria-live="polite">
            <h2 className="quote-summary-title">Resumen de cotización</h2>
            {selected ? (
              <>
                <div className="quote-summary-badge">{selected.linea || 'ISUZU'}</div>
                <p className="quote-model-name">{selected.modelo}</p>
                <p className="quote-capacity">{selected.capacidad_carga || '—'}</p>
                <p className="quote-precio" aria-label="Precio de lista">
                  {formatPrice(precioLista)}
                </p>
                {selected.precio_2026 != null &&
                  selected.precio != null &&
                  selected.precio_2026 !== selected.precio && (
                    <p className="quote-precio-alt">
                      Referencia 2026 (lista): {formatPrice(Number(selected.precio_2026))}
                    </p>
                  )}
                <dl className="quote-dl">
                  <div>
                    <dt>Rendimiento</dt>
                    <dd>{selected.km_litro || '—'}</dd>
                  </div>
                  <div>
                    <dt>Motor</dt>
                    <dd title={selected.motor}>{motorResumen}</dd>
                  </div>
                  <div>
                    <dt>Potencia / torque</dt>
                    <dd>
                      {selected.hp || '—'} {selected.torque ? `· ${selected.torque}` : ''}
                    </dd>
                  </div>
                  <div>
                    <dt>Garantía</dt>
                    <dd>{selected.garantia || '—'}</dd>
                  </div>
                  <div>
                    <dt>Año modelo</dt>
                    <dd>{selected.ano_modelo ?? '—'}</dd>
                  </div>
                </dl>
                <Link to="/catalogo" className="quote-link-catalogo">
                  Ver ficha completa en catálogo →
                </Link>
              </>
            ) : (
              <p className="quote-empty">Selecciona un modelo en la grilla.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  );
}
