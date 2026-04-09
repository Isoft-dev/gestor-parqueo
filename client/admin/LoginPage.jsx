import { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

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
    return <Navigate to={from} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(correo.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      const msg = String(err?.message || '');
      if (/desactivad/i.test(msg)) {
        setError('La cuenta no está activa.');
      } else {
        setError('Credenciales incorrectas o no se pudo completar el inicio de sesión.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="admin-page" style={{ maxWidth: 420, margin: '48px auto', padding: 24 }}>
      <h1 className="admin-page-title" style={{ marginTop: 0 }}>
        Iniciar sesión
      </h1>
      <p className="admin-page-desc">Acceso al panel de administración.</p>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Correo</span>
          <input
            type="email"
            autoComplete="username"
            value={correo}
            onChange={(e) => setCorreo(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px' }}
          />
        </label>
        <label>
          <span style={{ display: 'block', marginBottom: 4, fontWeight: 600 }}>Contraseña</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ width: '100%', padding: '10px 12px' }}
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
  );
}
