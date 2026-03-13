import { useState, useEffect } from 'react';
import './Catalogo.css';

interface Modelo {
  id: string;
  catalogo: string;
  familia: string;
  precio: string;
  capacidadCarga: string;
  kmPorLitro: string;
}

export function Catalogo() {
  const [modelos, setModelos] = useState<Modelo[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    fetch('/api/modelos')
      .then(res => res.ok ? res.json() : Promise.reject(res))
      .then(data => setModelos(data))
      .catch(() => setModelos([]))
      .finally(() => setLoading(false));
  }, []);

  const filtered = modelos.filter(
    m =>
      m.catalogo.toLowerCase().includes(filter.toLowerCase()) ||
      m.familia.toLowerCase().includes(filter.toLowerCase())
  );

  const formatPrice = (n: string) =>
    new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(parseFloat(n || '0'));

  return (
    <div className="page catalogo">
      <div className="page-header">
        <h1>Catálogo</h1>
        <p>Todos los modelos Isuzu disponibles</p>
        <input
          type="search"
          placeholder="Buscar por modelo o familia..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="search-input"
        />
      </div>

      {loading ? (
        <div className="loading">
          <div className="spinner"></div>
          <p>Cargando...</p>
        </div>
      ) : (
        <div className="catalogo-table-wrap">
          <table className="catalogo-table">
            <thead>
              <tr>
                <th>Modelo</th>
                <th>Familia</th>
                <th>Capacidad</th>
                <th>Consumo</th>
                <th>Precio</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(m => (
                <tr key={m.id}>
                  <td><strong>{m.catalogo}</strong></td>
                  <td><span className="badge">{m.familia}</span></td>
                  <td>{m.capacidadCarga || '-'}</td>
                  <td>{m.kmPorLitro || '-'}</td>
                  <td className="price-cell">{formatPrice(m.precio)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
