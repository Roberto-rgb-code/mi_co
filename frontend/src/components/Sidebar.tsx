import { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Sidebar.css';

export function Sidebar() {
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
      <div className="sidebar-header">
        <div className="sidebar-brand">
          <span className="sidebar-logo">ISUZU</span>
          <span className="sidebar-sub">Cotizador</span>
        </div>
        <button
          type="button"
          className="sidebar-toggle"
          onClick={() => setCollapsed(!collapsed)}
          title={collapsed ? 'Expandir' : 'Colapsar'}
          aria-label={collapsed ? 'Expandir menú' : 'Colapsar menú'}
        >
          {collapsed ? '→' : '←'}
        </button>
      </div>

      <nav className="sidebar-nav">
        <NavLink to="/" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} end title="Inicio">
          <span className="nav-icon">🏠</span>
          <span className="nav-text">Inicio</span>
        </NavLink>
        <NavLink to="/cotizador" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Cotizador">
          <span className="nav-icon">📋</span>
          <span className="nav-text">Cotizador</span>
        </NavLink>
        <NavLink to="/catalogo" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Catálogo">
          <span className="nav-icon">🚛</span>
          <span className="nav-text">Catálogo</span>
        </NavLink>
        <NavLink to="/asistente" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`} title="Asistente">
          <span className="nav-icon">💬</span>
          <span className="nav-text">Asistente</span>
        </NavLink>
      </nav>

      <div className="sidebar-footer">
        {user && (
          <div className="sidebar-user">
            <span className="user-email" title={user.email}>{user.email}</span>
            <button type="button" className="btn-logout" onClick={logout} title="Cerrar sesión">
              {collapsed ? '🚪' : 'Cerrar sesión'}
            </button>
          </div>
        )}
      </div>
    </aside>
  );
}
