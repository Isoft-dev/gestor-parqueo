import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth, isAdminPanelUser } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/admin';
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={isAdminPanelUser(user) ? from : '/'} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await login(correo.trim(), password);
      navigate(isAdminPanelUser(session) ? from : '/', { replace: true });
    } catch (err) {
      const msg = String(err?.message || '');
      if (/desactivad/i.test(msg)) {
        setError('La cuenta no está activa.');
      } else if (/ora-\d+|conexi[oó]n|database|db/i.test(msg)) {
        setError('No se pudo validar el usuario por un problema de conexión con la base de datos.');
      } else {
        setError('Credenciales incorrectas o no se pudo completar el inicio de sesión.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <div className="login-page-back" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/maquina-entrada" className="ops-header-auth-link">
          Ir a máquina de entrada
        </Link>
        <Link to="/maquina-cobro" className="ops-header-auth-link">
          Ir a máquina de cobro
        </Link>
        <Link to="/maquina-salida" className="ops-header-auth-link">
          Ir a máquina de salida
        </Link>
      </div>
      <div className="admin-page login-page-shell">
        <div className="admin-panel-block login-page-card">
          <h1 className="admin-page-title login-page-title">Iniciar sesión</h1>
          <p className="admin-page-desc">Acceso al panel de administración.</p>
          <form onSubmit={onSubmit} className="login-page-form">
          <label>
            <span className="login-page-label">Correo</span>
            <input
              type="email"
              autoComplete="username"
              value={correo}
              onChange={(e) => setCorreo(e.target.value)}
              required
              className="login-page-input"
            />
          </label>
          <label>
            <span className="login-page-label">Contraseña</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="login-page-input"
            />
          </label>
          {error ? (
            <div className="admin-banner admin-banner--error" role="alert">
              {error}
            </div>
          ) : null}
          <button type="submit" className="admin-btn-primary" disabled={loading}>
            {loading ? 'Entrando…' : 'Entrar'}
          </button>
          </form>
        </div>
      </div>
    </>
  );
}
