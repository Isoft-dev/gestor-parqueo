/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, useState } from 'react';
import { ADMIN_APPEARANCE_KEY, THEME_KEY } from '../config.js';
import {
  buildAdminAppearanceVars,
  DEFAULT_ADMIN_APPEARANCE,
  loadAdminAppearance,
  sanitizeAdminAppearance,
} from '../utils/adminAppearance.js';

const AdminAppearanceContext = createContext(null);

export function AdminAppearanceProvider({ children }) {
  const [appearance, setAppearance] = useState(() => loadAdminAppearance());

  useEffect(() => {
    const sanitized = sanitizeAdminAppearance(appearance);
    const root = document.documentElement;

    root.setAttribute('data-theme', sanitized.mode);
    const vars = buildAdminAppearanceVars(sanitized);
    Object.entries(vars).forEach(([name, value]) => {
      root.style.setProperty(name, value);
    });

    try {
      localStorage.setItem(ADMIN_APPEARANCE_KEY, JSON.stringify(sanitized));
      localStorage.setItem(THEME_KEY, sanitized.mode);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [appearance]);

  function updateAppearance(patch) {
    setAppearance((current) => sanitizeAdminAppearance({ ...current, ...patch }));
  }

  function resetAppearance() {
    setAppearance(DEFAULT_ADMIN_APPEARANCE);
  }

  return (
    <AdminAppearanceContext.Provider value={{ appearance, updateAppearance, resetAppearance }}>
      {children}
    </AdminAppearanceContext.Provider>
  );
}

export function useAdminAppearance() {
  const context = useContext(AdminAppearanceContext);
  if (!context) {
    throw new Error('useAdminAppearance debe usarse dentro de AdminAppearanceProvider');
  }
  return context;
}
