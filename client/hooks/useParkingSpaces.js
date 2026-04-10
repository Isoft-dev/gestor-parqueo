import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';

const POLL_MS = 5000;

export function useParkingSpaces(options = {}) {
  const pollMs = options.pollMs ?? POLL_MS;
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async ({ silent } = {}) => {
    if (!silent) {
      setCargando(true);
      setError(null);
    }
    try {
      const res = await fetch(`${API_BASE}/espacio`);
      if (!res.ok) throw new Error('Error al cargar espacios');
      setEspacios(await res.json());
      if (!silent) setError(null);
    } catch (err) {
      if (!silent) setError(err.message);
    } finally {
      if (!silent) setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar({ silent: false });
    if (pollMs <= 0) return undefined;
    const id = setInterval(() => cargar({ silent: true }), pollMs);
    return () => clearInterval(id);
  }, [cargar, pollMs]);

  const agregar = async (espacio) => {
    const res = await fetch(`${API_BASE}/espacio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(espacio),
    });
    if (!res.ok) throw new Error('Error al agregar espacio');
    const nuevo = await res.json();
    setEspacios((prev) => [...prev, nuevo]);
    return nuevo;
  };

  const actualizar = async (id, datos) => {
    const res = await fetch(`${API_BASE}/espacio/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (!res.ok) throw new Error('Error al actualizar espacio');
    const actualizado = await res.json();
    const idKey = (row) => row?.ESP_ID ?? row?.esp_id ?? row?.id;
    setEspacios((prev) => prev.map((e) => (String(idKey(e)) === String(id) ? actualizado : e)));
    return actualizado;
  };

  const eliminar = async (id) => {
    const res = await fetch(`${API_BASE}/espacio/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar espacio');
    const idKey = (row) => row?.ESP_ID ?? row?.esp_id ?? row?.id;
    setEspacios((prev) => prev.filter((e) => String(idKey(e)) !== String(id)));
  };

  return { espacios, cargando, error, cargar, agregar, actualizar, eliminar };
}
