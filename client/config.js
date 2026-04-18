// En dev usamos el proxy de Vite (/api -> localhost:3001).
// En producción normalmente necesitas apuntar a un backend desplegado.
export const API_BASE = import.meta.env.VITE_API_BASE || '/api';

export const THEME_KEY = 'parqueo-theme';
export const DEFAULT_THEME = 'light';
