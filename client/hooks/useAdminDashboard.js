import { useCallback, useEffect, useState } from 'react';
import { API_BASE } from '../config.js';

const POLL_MS = 5000;

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

function isDisponibleState(s) {
  const x = norm(s);
  return x.includes('dispon') || x.includes('libre') || x.includes('vacant');
}

function isOcupadoState(s) {
  const x = norm(s);
  return x.includes('ocup') || x.includes('busy') || x.includes('used');
}

function isReservadoState(s) {
  const x = norm(s);
  return x.includes('reserv');
}

function pick(row, ...names) {
  if (!row) return undefined;
  for (const n of names) {
    if (row[n] != null && row[n] !== '') return row[n];
    const u = n.toUpperCase();
    if (row[u] != null && row[u] !== '') return row[u];
    const l = n.toLowerCase();
    if (row[l] != null && row[l] !== '') return row[l];
  }
  return undefined;
}

async function fetchJsonAll(path) {
  const res = await fetch(`${API_BASE}${path}`);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }
  if (!res.ok) {
    const hint = data?.error || data?.message;
    const fallback = (text && text.length < 400 && !text.trim().startsWith('<')) ? text.trim() : '';
    throw new Error(
      hint || fallback || res.statusText || 'Error de red',
    );
  }
  return Array.isArray(data) ? data : [];
}

export function useAdminDashboard() {
  const [stats, setStats] = useState({
    espaciosDisponibles: null,
    espaciosTotales: null,
    espaciosReservadosOcupados: null,
    espaciosReservadosLibres: null,
    alertasPendientes: null,
    alertasActivasCatalogo: null,
    membresiasActivas: null,
    membresiasSuspendidas: null,
    ultimasAlertas: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sectionErrors, setSectionErrors] = useState([]);
  const [updatedAt, setUpdatedAt] = useState(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const requests = [
        ['espacio', '/espacio'],
        ['alerta', '/alerta'],
        ['estado-alerta', '/estado-alerta'],
        ['membresia', '/membresia'],
        ['estado-membresia', '/estado-membresia'],
      ];
      const settled = await Promise.allSettled(
        requests.map(([, path]) => fetchJsonAll(path)),
      );
      const failed = settled
        .map((r, i) =>
          r.status === 'rejected'
            ? `${requests[i][0]}: ${r.reason?.message || r.reason}`
            : null,
        )
        .filter(Boolean);
      if (failed.length) {
        setSectionErrors(failed);
        throw new Error(failed.join(' · '));
      }
      setSectionErrors([]);
      const [espacios, alertas, estadosAlerta, membresias, estadosMembresia] = settled.map((r) => r.value);

      const estadosPorId = {};
      for (const e of estadosAlerta) {
        const id = pick(e, 'EAL_ID');
        const texto = norm(pick(e, 'EAL_ESTADO'));
        if (id != null) estadosPorId[id] = texto;
      }

      let disponibles = 0;
      const espaciosById = {};
      for (const row of espacios) {
        const espId = pick(row, 'ESP_ID');
        const est = norm(pick(row, 'EES_ESTADO'));
        if (espId != null) {
          espaciosById[String(espId)] = est;
        }
        if (
          isDisponibleState(est)
        ) {
          disponibles += 1;
        }
      }

      let pendientesAtencion = 0;
      let activasCatalogo = 0;
      for (const a of alertas) {
        const fid = pick(a, 'EAL_ID');
        const label = estadosPorId[fid] || '';
        const sinAtencion = !pick(a, 'ALE_FECHA_ATENCION');
        if (sinAtencion) pendientesAtencion += 1;
        if (label.includes('activ') && !label.includes('inactiv')) activasCatalogo += 1;
      }

      const estadoMembresiaPorId = {};
      for (const em of estadosMembresia) {
        const id = pick(em, 'EME_ID');
        const label = norm(pick(em, 'EME_ESTADO'));
        if (id != null) estadoMembresiaPorId[id] = label;
      }

      let memAct = 0;
      let memSusp = 0;
      let reservadosOcupados = 0;
      let reservadosLibres = 0;
      for (const m of membresias) {
        const estadoLabel =
          norm(pick(m, 'EME_ESTADO')) || estadoMembresiaPorId[pick(m, 'EME_ID')] || '';
        const suspendida = estadoLabel.includes('suspend') || estadoLabel.includes('inactiv');

        if (suspendida) {
          memSusp += 1;
          continue;
        }

        memAct += 1;
        const espId = pick(m, 'ESP_ID');
        const espacioEstado = espaciosById[String(espId)] || '';
        if (isReservadoState(espacioEstado) && isOcupadoState(espacioEstado)) {
          reservadosOcupados += 1;
        } else if (isReservadoState(espacioEstado) && isDisponibleState(espacioEstado)) {
          reservadosLibres += 1;
        }
      }

      const ultimasAlertas = [...alertas]
        .sort((a, b) => {
          const da = new Date(pick(a, 'ALE_FECHA_HORA_GENERACION') || 0);
          const db = new Date(pick(b, 'ALE_FECHA_HORA_GENERACION') || 0);
          return db - da;
        })
        .slice(0, 6);

      setStats({
        espaciosDisponibles: disponibles,
        espaciosTotales: espacios.length,
        espaciosReservadosOcupados: reservadosOcupados,
        espaciosReservadosLibres: reservadosLibres,
        alertasPendientes: pendientesAtencion,
        alertasActivasCatalogo: activasCatalogo,
        membresiasActivas: memAct,
        membresiasSuspendidas: memSusp,
        ultimasAlertas,
      });
      setUpdatedAt(new Date());
    } catch (e) {
      setError(e.message || String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [load]);

  return { stats, loading, error, sectionErrors, reload: load, updatedAt, pollMs: POLL_MS };
}
