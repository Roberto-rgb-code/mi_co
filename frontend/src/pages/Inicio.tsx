import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Inicio.css';

export function Inicio() {
  const { user } = useAuth();

  return (
    <div className="page inicio">
      <section className="hero">
        <h1>Bienvenido{author(user?.name)}</h1>
        <p>Sistema de cotización para camiones Isuzu ELF y Forward</p>
      </section>
      <div className="quick-actions">
        <Link to="/cotizador" className="action-card">
          <span className="action-icon">📋</span>
          <h3>Cotizador</h3>
          <p>Genera cotizaciones en segundos</p>
        </Link>
        <Link to="/catalogo" className="action-card">
          <span className="action-icon">🚛</span>
          <h3>Catálogo</h3>
          <p>Explora todos los modelos disponibles</p>
        </Link>
        <Link to="/asistente" className="action-card">
          <span className="action-icon">💬</span>
          <h3>Asistente</h3>
          <p>Orientación según carga, precio y giro de tu negocio</p>
        </Link>
        <Link to="/comparativa" className="action-card">
          <span className="action-icon">⚖️</span>
          <h3>Comparativa</h3>
          <p>Compara un camión de la competencia con modelos ISUZU del catálogo</p>
        </Link>
      </div>
    </div>
  );
}

function author(name?: string) {
  if (!name) return '';
  const n = name.charAt(0).toUpperCase() + name.slice(1);
  return `, ${n}`;
}
