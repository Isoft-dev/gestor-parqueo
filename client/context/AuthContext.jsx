import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { API_BASE } from '../config.js';

const STORAGE_KEY = 'parqueo_admin_session';

/** Acceso al panel /admin: rol tipo administrador (p. ej. «Administrador» en BD). */
export function isAdminPanelUser(user) {
  if (!user) return false;
  const t = String(user.ROL_TIPO ?? user.rol_tipo ?? '').toLowerCase();
  if (!t) return false;
  return t.includes('admin');
}

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  });

  const login = useCallback(async (USU_CORREO, USU_PASSWORD) => {
    const res = await fetch(`${API_BASE}/usuario/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ USU_CORREO, USU_PASSWORD }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(data.error || 'No se pudo iniciar sesión');
    }
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    setUser(data);
    return data;
  }, []);

  const logout = useCallback(() => {
    sessionStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, login, logout }), [user, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}
