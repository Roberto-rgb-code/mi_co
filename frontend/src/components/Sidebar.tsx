import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

export function Sidebar() {
  const { user, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <span className="sidebar-logo">ISUZU</span>
        <span className="sidebar-sub">Cotizador</span>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end>
          <span className="nav-icon">🏠</span>
          Inicio
        </NavLink>
        <NavLink to="/cotizador" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">📋</span>
          Cotizador
        </NavLink>
        <NavLink to="/catalogo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
          <span className="nav-icon">🚛</span>
          Catálogo
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <span className="user-email">{user.email}</span>
            <button type="button" className="btn-logout" onClick={logout}>
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
