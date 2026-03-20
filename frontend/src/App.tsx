import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Inicio } from './pages/Inicio';
import { Cotizador } from './pages/Cotizador';
import { Catalogo } from './pages/Catalogo';
import { Asistente } from './pages/Asistente';
import { CRM } from './pages/CRM';
import { ClienteDetalle } from './pages/ClienteDetalle';
import { ClienteNuevo } from './pages/ClienteNuevo';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      {/* Layout sin path: evita Outlet vacío al entrar en /catalogo, /cotizador, etc. */}
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Inicio />} />
        <Route path="/cotizador" element={<Cotizador />} />
        <Route path="/catalogo" element={<Catalogo />} />
        <Route path="/asistente" element={<Asistente />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/crm/nuevo" element={<ClienteNuevo />} />
        <Route path="/crm/:id" element={<ClienteDetalle />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
