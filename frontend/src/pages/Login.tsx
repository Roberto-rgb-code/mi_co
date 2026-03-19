import { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { DotLottieReact } from '@lottiefiles/dotlottie-react';
import './Login.css';

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim()) {
      setError('Ingresa tu correo electrónico');
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
      <div className="login-left">
        <DotLottieReact
          src="https://lottie.host/3b1e64cb-f6d8-4e7f-b7ce-94ea2cfc9903/pcgdZmvkPx.lottie"
          loop
          autoplay
        />
      </div>
      <div className="login-right">
      <div className="login-card">
        <div className="login-header">
          <span className="login-logo">ISUZU</span>
          <span className="login-sub">Cotizador</span>
          <p>Inicia sesión para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Correo electrónico</label>
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
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>
          {error && <p className="login-error">{error}</p>}
          <button type="submit" className="btn-primary">
            Iniciar sesión
          </button>
        </form>
        <p className="login-demo">Demo: cualquier email y contraseña</p>
      </div>
      </div>
    </div>
  );
}
