import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { canAccessAdminPanel, getAdminHomePath } from './adminRoleAccess.js';
import { sanitizeFieldValue, getFieldPlaceholder } from '../utils/fieldValidation.js';
import { useAdminAppearance } from '../context/AdminAppearanceContext.jsx';
import { toAlpha } from '../utils/adminAppearance.js';

const KIOSK_SHORTCUTS = [
  {
    to: '/maquina-entrada',
    icon: '🎟️',
    title: 'Máquina de entrada',
    description: 'Generar tickets esporádicos o validar tag de cliente mensual.',
    accentKey: 'machineEntryAccent',
  },
  {
    to: '/maquina-cobro',
    icon: '💳',
    title: 'Máquina de cobro',
    description: 'Cobrar tickets, membresías y registrar pagos en caja.',
    accentKey: 'machineCashAccent',
  },
  {
    to: '/maquina-salida',
    icon: '🚪',
    title: 'Máquina de salida',
    description: 'Validar salida con ticket pagado o tag de membresía activa.',
    accentKey: 'machineExitAccent',
  },
];

function kioskCardStyle(appearance, accentHex) {
  const accent = accentHex || appearance.primaryColor;
  return {
    '--module-accent': accent,
    '--module-accent-soft': toAlpha(accent, appearance.mode === 'dark' ? 0.18 : 0.11),
    '--module-accent-shadow': toAlpha(accent, 0.24),
  };
}

export default function LoginPage() {
  const { user, login } = useAuth();
  const { appearance } = useAdminAppearance();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || null;
  const [correo, setCorreo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  if (user) {
    return <Navigate to={canAccessAdminPanel(user) ? (from || getAdminHomePath(user)) : '/'} replace />;
  }

  async function onSubmit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const session = await login(correo.trim(), password);
      navigate(canAccessAdminPanel(session) ? (from || getAdminHomePath(session)) : '/', { replace: true });
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
    <div className="login-page">
      <div className="login-page-split">
        <aside className="login-kiosk-column" aria-label="Acceso directo a máquinas">
          <div className="login-kiosk-column__head">
            <h2 className="login-kiosk-section__title">Cabinas</h2>
            <p className="login-kiosk-section__desc">
              Acceso rápido sin sesión para pantallas de entrada, cobro o salida.
            </p>
          </div>
          <div className="login-kiosk-grid">
            {KIOSK_SHORTCUTS.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                state={{ fromLogin: true }}
                className="login-kiosk-card admin-quick-card"
                style={kioskCardStyle(appearance, appearance[item.accentKey])}
              >
                <span className="login-kiosk-card__icon" aria-hidden="true">
                  {item.icon}
                </span>
                <span className="login-kiosk-card__title">{item.title}</span>
                <span className="login-kiosk-card__desc">{item.description}</span>
                <span className="login-kiosk-card__cta">Abrir cabina →</span>
              </Link>
            ))}
          </div>
        </aside>

        <main className="login-main-column" aria-label="Inicio de sesión">
          <header className="login-page-brand">
            <span className="login-page-brand__mark" aria-hidden="true">
              🅿️
            </span>
            <div>
              <h1 className="login-page-brand__title">Gestor de Parqueo</h1>
              <p className="login-page-brand__sub">Panel administrativo</p>
            </div>
          </header>

          <section className="admin-panel-block login-page-card">
            <h2 className="login-page-card__heading">Iniciar sesión</h2>
            <p className="admin-page-desc login-page-card__desc">
              Acceso al sistema según el rol asignado (administración, reportes, configuración).
            </p>
            <form onSubmit={onSubmit} className="login-page-form">
              <label>
                <span className="login-page-label">Correo</span>
                <input
                  type="email"
                  autoComplete="username"
                  value={correo}
                  onChange={(e) => setCorreo(sanitizeFieldValue('USU_CORREO', e.target.value))}
                  placeholder={getFieldPlaceholder('USU_CORREO')}
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
                  onChange={(e) => setPassword(sanitizeFieldValue('USU_PASSWORD', e.target.value))}
                  placeholder={getFieldPlaceholder('USU_PASSWORD')}
                  required
                  className="login-page-input"
                />
              </label>
              {error ? (
                <div className="admin-banner admin-banner--error" role="alert">
                  {error}
                </div>
              ) : null}
              <button type="submit" className="admin-btn-primary login-page-submit" disabled={loading}>
                {loading ? 'Entrando…' : 'Entrar al panel'}
              </button>
            </form>
          </section>
        </main>
      </div>
    </div>
  );
}
