import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import './CRM.css';

export interface ClienteDto {
  id: string;
  nombre: string;
  email: string;
  telefono?: string;
  empresa?: string;
  productoTransportar?: string;
  cantidadTarimas?: number;
  tarimaLargo?: number;
  tarimaAncho?: number;
  tarimaAlto?: number;
  pesoEstimadoKg?: number;
  requerimientos?: string;
  modeloRecomendado?: string;
  notaNecesidades?: string;
  createdAt: string;
}

export function CRM() {
  const [clientes, setClientes] = useState<ClienteDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/clientes')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Error ${r.status}`))))
      .then(setClientes)
      .catch(() => setError('No se pudieron cargar los clientes. Revisa el deploy y que la tabla clientes exista en la base de datos.'))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="page crm">
      <div className="crm-header">
        <h1>CRM — Clientes</h1>
        <p className="crm-sub">Gestiona clientes, captura necesidades y obtén recomendaciones con el asistente.</p>
        <Link to="/crm/nuevo" className="btn-primary">
          + Nuevo cliente
        </Link>
      </div>

      {error && (
        <div className="crm-error" role="alert">
          {error}
        </div>
      )}

      {loading && (
        <div className="crm-loading">
          <div className="spinner" />
          <p>Cargando clientes…</p>
        </div>
      )}

      {!loading && !error && clientes.length === 0 && (
        <div className="crm-empty">
          <p>No hay clientes registrados.</p>
          <Link to="/crm/nuevo" className="btn-primary">
            Crear primer cliente
          </Link>
        </div>
      )}

      {!loading && !error && clientes.length > 0 && (
        <div className="crm-grid">
          {clientes.map((c) => (
            <Link key={c.id} to={`/crm/${c.id}`} className="crm-card">
              <div className="crm-card-header">
                <h3>{c.nombre}</h3>
                {c.empresa && <span className="crm-card-empresa">{c.empresa}</span>}
              </div>
              <p className="crm-card-email">{c.email}</p>
              {c.productoTransportar && (
                <p className="crm-card-producto">
                  <strong>Producto:</strong> {c.productoTransportar}
                </p>
              )}
              {c.cantidadTarimas != null && c.cantidadTarimas > 0 && (
                <p className="crm-card-tarimas">{c.cantidadTarimas} tarimas</p>
              )}
              {c.modeloRecomendado && (
                <span className="crm-card-modelo">{c.modeloRecomendado}</span>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
