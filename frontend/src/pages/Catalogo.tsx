import { useState, useEffect } from 'react';
import type { ModeloCatalog } from '../data/catalog';
import { ModeloCard } from '../components/ModeloCard';
import { ModeloDetalle } from '../components/ModeloDetalle';
import './Catalogo.css';

export function Catalogo() {
  const [modelos, setModelos] = useState<ModeloCatalog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');
  const [lineaFilter, setLineaFilter] = useState<string>('todas');
  const [selected, setSelected] = useState<ModeloCatalog | null>(null);

  useEffect(() => {
    Promise.all([fetch('/catalog_data.json').then(r => r.json()), fetch('/model_images.json').then(r => r.json()).catch(() => ({}))])
      .then(([data, images]) => {
        const obj = data.modelos || {};
        const imageMap = images as Record<string, string>;
        const list = Object.entries(obj).map(([key, val]) => {
          const m = val as ModeloCatalog & { image?: string };
          const modelo = m.modelo || key;
          return { ...m, modelo, image: imageMap[modelo] };
        });
        setModelos(list);
      })
      .catch(() => setModelos([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = modelos.filter(m => {
    const matchSearch =
      m.modelo?.toLowerCase().includes(filter.toLowerCase()) ||
      m.linea?.toLowerCase().includes(filter.toLowerCase());
    const matchLinea = lineaFilter === 'todas' || m.linea === lineaFilter;
    return matchSearch && matchLinea;
  });

  return (
    <div className="page catalogo">
      <div className="page-header">
        <h1>Catálogo</h1>
        <p>Todos los modelos Isuzu con especificaciones completas</p>
        <div className="catalogo-filters">
          <input
            type="search"
            placeholder="Buscar modelo..."
            value={filter}
            onChange={e => setFilter(e.target.value)}
            className="search-input"
          />
          <select
            value={lineaFilter}
            onChange={e => setLineaFilter(e.target.value)}
            className="linea-select"
          >
            <option value="todas">Todas las líneas</option>
            <option value="ELF">ELF</option>
            <option value="Forward">Forward</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner" />
          <p>Cargando catálogo...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <p>No hay modelos que coincidan con tu búsqueda.</p>
        </div>
      ) : (
        <div className="catalogo-grid">
          {filtered.map(m => (
            <ModeloCard key={m.modelo} modelo={m} onClick={() => setSelected(m)} />
          ))}
        </div>
      )}

      {selected && (
        <ModeloDetalle modelo={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
