import { useState, useEffect } from 'react';
import { THEME_KEY, DEFAULT_THEME } from '../config';

export function useTheme() {
  const [tema, setTema] = useState(() => {
    try {
      return localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
    } catch {
      return DEFAULT_THEME;
    }
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', tema);
    try {
      localStorage.setItem(THEME_KEY, tema);
    } catch {
      /* almacenamiento no disponible */
    }
  }, [tema]);

  return { tema, setTema };
}
