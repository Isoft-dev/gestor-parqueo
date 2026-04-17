/**
 * Capacidad y estados de PAR_ESPACIO según HU Jorge (esporádico vs mensual).
 * Espacios sin fila en PAR_MEMBRESIA = pool esporádico (disponible ↔ ocupado).
 * Espacios con membresía = reservado libre ↔ reservado ocupado.
 */

import { getConnection } from '../db/oracle.js';

function norm(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/**
 * @param {import('oracledb').Connection} conn
 */
export async function resolveParkingStateIdsTx(conn) {
  const r = await conn.execute(`SELECT EES_ID, EES_ESTADO FROM PAR_ESTADO_ESPACIO`);
  const rows = r.rows || [];
  const list = rows.map((row) => ({
    id: row.EES_ID ?? row.ees_id,
    label: norm(row.EES_ESTADO ?? row.ees_estado),
  }));

  const pick = (pred) => {
    const hit = list.find((s) => pred(s.label));
    return hit?.id ?? null;
  };

  const sporadicDisponible = pick(
    (l) =>
      !l.includes('reserv') &&
      (l.includes('dispon') || l.includes('libre') || l.includes('vacant')),
  );
  let sporadicOcupado = pick((l) => !l.includes('reserv') && l.includes('ocup'));
  if (sporadicOcupado == null) {
    sporadicOcupado = pick((l) => l.includes('ocup') && !l.includes('reserv'));
  }

  const reservadoOcupado = pick((l) => l.includes('reserv') && l.includes('ocup'));
  const reservadoLibre = pick(
    (l) =>
      l.includes('reserv') &&
      (l.includes('libre') || l.includes('dispon') || l.includes('vacant')),
  );

  return {
    sporadicDisponible,
    sporadicOcupado,
    reservadoOcupado,
    reservadoLibre,
  };
}

/**
 * Ocupa un espacio del pool esporádico (no asignado a membresía).
 */
export async function occupySporadicSlotTx(conn) {
  const { sporadicDisponible, sporadicOcupado } = await resolveParkingStateIdsTx(conn);
  if (sporadicDisponible == null || sporadicOcupado == null) {
    throw new Error(
      'Configuracion incompleta: se requieren estados en PAR_ESTADO_ESPACIO para espacios esporadicos (disponible/libre sin reserva y ocupado sin reserva).',
    );
  }

  const find = await conn.execute(
    `SELECT e.ESP_ID
       FROM PAR_ESPACIO e
       LEFT JOIN PAR_MEMBRESIA m ON m.ESP_ID = e.ESP_ID
      WHERE m.MEM_ID IS NULL
        AND e.EES_ID = :disponibleEes
      ORDER BY e.ESP_ID
      FETCH FIRST 1 ROW ONLY`,
    { disponibleEes: sporadicDisponible },
  );
  const espId = find.rows?.[0]?.ESP_ID ?? find.rows?.[0]?.esp_id;
  if (espId == null) {
    throw new Error('Parqueo lleno: no hay espacios disponibles para vehiculos esporadicos');
  }

  await conn.execute(
    `UPDATE PAR_ESPACIO SET EES_ID = :ocupadoEes WHERE ESP_ID = :espId`,
    { ocupadoEes: sporadicOcupado, espId },
  );
  return espId;
}

/**
 * Libera un espacio esporádico (vuelve a disponible).
 */
export async function releaseSporadicSlotTx(conn) {
  const { sporadicDisponible, sporadicOcupado } = await resolveParkingStateIdsTx(conn);
  if (sporadicDisponible == null || sporadicOcupado == null) {
    return;
  }

  const find = await conn.execute(
    `SELECT e.ESP_ID
       FROM PAR_ESPACIO e
       LEFT JOIN PAR_MEMBRESIA m ON m.ESP_ID = e.ESP_ID
      WHERE m.MEM_ID IS NULL
        AND e.EES_ID = :ocupadoEes
      ORDER BY e.ESP_ID DESC
      FETCH FIRST 1 ROW ONLY`,
    { ocupadoEes: sporadicOcupado },
  );
  const espId = find.rows?.[0]?.ESP_ID ?? find.rows?.[0]?.esp_id;
  if (espId == null) return;

  await conn.execute(
    `UPDATE PAR_ESPACIO SET EES_ID = :libreEes WHERE ESP_ID = :espId`,
    { libreEes: sporadicDisponible, espId },
  );
}

/**
 * Mensual: al ingreso con tag, espacio pasa a reservado ocupado.
 */
export async function setMembresiaEspacioReservadoOcupadoTx(conn, espId) {
  if (!espId) return;
  const { reservadoOcupado } = await resolveParkingStateIdsTx(conn);
  if (reservadoOcupado == null) return;
  await conn.execute(
    `UPDATE PAR_ESPACIO SET EES_ID = :ees WHERE ESP_ID = :espId`,
    { ees: reservadoOcupado, espId },
  );
}

/**
 * Mensual: al egreso con tag, espacio pasa a reservado libre.
 */
export async function setMembresiaEspacioReservadoLibreTx(conn, espId) {
  if (!espId) return;
  const { reservadoLibre } = await resolveParkingStateIdsTx(conn);
  if (reservadoLibre == null) return;
  await conn.execute(
    `UPDATE PAR_ESPACIO SET EES_ID = :ees WHERE ESP_ID = :espId`,
    { ees: reservadoLibre, espId },
  );
}

/**
 * Tras crear membresía: el espacio queda reservado (libre hasta que ingrese el vehículo).
 */
export async function setEspacioReservadoLibreAfterMembresiaTx(conn, espId) {
  if (!espId) return;
  const { reservadoLibre } = await resolveParkingStateIdsTx(conn);
  if (reservadoLibre == null) return;
  await conn.execute(
    `UPDATE PAR_ESPACIO SET EES_ID = :ees WHERE ESP_ID = :espId`,
    { ees: reservadoLibre, espId },
  );
}

/** Transacción propia tras INSERT membresía (create ya hizo commit). */
export async function afterMembresiaCreatedSetEspacioReservadoLibre(espId) {
  if (!espId) return;
  let conn;
  try {
    conn = await getConnection();
    await setEspacioReservadoLibreAfterMembresiaTx(conn, espId);
    await conn.commit();
  } catch (e) {
    if (conn) {
      try {
        await conn.rollback();
      } catch {
        /* ignore */
      }
    }
    throw e;
  } finally {
    if (conn) await conn.close();
  }
}
