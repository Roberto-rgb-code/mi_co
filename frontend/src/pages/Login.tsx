import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './Login.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico');
      return;
    }
    if (!password) {
      setError('Ingresa tu contraseña');
      return;
    }
    if (login(email, password)) {
      navigate('/');
    } else {
      setError('Credenciales inválidas');
    }
  };

  return (
    <div className="login-page">
      {/* Panel izquierdo: animación y mensaje */}
      <div className="login-left">
        <div className="login-left-inner">
          <div className="login-lottie-wrap">
            <DotLottieReact
              src="https://lottie.host/3b1e64cb-f6d8-4e7f-b7ce-94ea2cfc9903/pcgdZmvkPx.lottie"
              loop
              autoplay
            />
          </div>
          <h2 className="login-left-title">Cotiza tu ISUZU</h2>
          <p className="login-left-sub">
            Accede al cotizador para configurar tu vehículo y obtener tu propuesta.
          </p>
        </div>
        <div className="login-left-bg-circles" aria-hidden="true" />
      </div>

      {/* Panel derecho: formulario */}
      <div className="login-right">
        <div className="login-right-inner">
          <div className="login-brand">
            <span className="login-logo">ISUZU</span>
            <span className="login-sub">Cotizador</span>
          </div>
          <h1 className="login-welcome">Bienvenido</h1>
          <p className="login-instruction">
            Ingresa tus credenciales para acceder al sistema.
          </p>
          <form onSubmit={handleSubmit} className="login-form">
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tu@email.com"
                autoComplete="email"
              />
            </div>
            <div className="form-group">
              <label htmlFor="password">Contraseña</label>
              <div className="input-password-wrap">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  title={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                >
                  {showPassword ? (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            <label className="login-remember">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>Recordarme</span>
            </label>
            {error && <p className="login-error">{error}</p>}
            <button type="submit" className="btn-primary">
              Iniciar sesión
            </button>
          </form>
          <p className="login-demo">Acceso restringido: solo credenciales autorizadas.</p>
        </div>
      </div>
    </div>
  );
}
