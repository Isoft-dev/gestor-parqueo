import { useState, useEffect, useCallback } from 'react';
import { API_BASE } from '../config';

export function useParkingSpaces() {
  const [espacios, setEspacios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  const cargar = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/espacios`);
      if (!res.ok) throw new Error('Error al cargar espacios');
      setEspacios(await res.json());
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargar();
  }, [cargar]);

  const agregar = async (espacio) => {
    const res = await fetch(`${API_BASE}/espacios`, {
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
    const res = await fetch(`${API_BASE}/espacios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    if (!res.ok) throw new Error('Error al actualizar espacio');
    const actualizado = await res.json();
    setEspacios((prev) => prev.map((e) => (e.id === id ? actualizado : e)));
    return actualizado;
  };

  const eliminar = async (id) => {
    const res = await fetch(`${API_BASE}/espacios/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar espacio');
    setEspacios((prev) => prev.filter((e) => e.id !== id));
  };

  return { espacios, cargando, error, cargar, agregar, actualizar, eliminar };
}
