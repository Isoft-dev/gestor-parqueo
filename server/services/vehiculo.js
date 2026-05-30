import { assertValidPlate, normalizePlate } from '../utils/plate.js';
import { executeSql } from '../db/oracle.js';
import { vehiculoCatalogJoin, vehiculoCatalogSelect } from '../utils/vehiculoCatalogSql.js';

const VEHICULO_MEMBRESIA_RESUMEN_JOIN = `
LEFT JOIN (
  SELECT ranked.VEH_ID,
         ranked.MEM_ID,
         ranked.MEM_FECHA_INICIO,
         ranked.MEM_FECHA_VENCIMIENTO,
         ranked.EME_ID,
         ranked.EME_ESTADO
    FROM (
      SELECT m.VEH_ID,
             m.MEM_ID,
             m.MEM_FECHA_INICIO,
             m.MEM_FECHA_VENCIMIENTO,
             m.EME_ID,
             CASE
               WHEN m.MEM_FECHA_VENCIMIENTO IS NOT NULL
                    AND TRUNC(m.MEM_FECHA_VENCIMIENTO) < TRUNC(SYSDATE)
               THEN 'Vencida'
               ELSE em.EME_ESTADO
             END AS EME_ESTADO,
             ROW_NUMBER() OVER (
               PARTITION BY m.VEH_ID
               ORDER BY
                 CASE
                   WHEN LOWER(NVL(em.EME_ESTADO, 'activa')) LIKE '%activ%'
                        AND (
                          m.MEM_FECHA_VENCIMIENTO IS NULL
                          OR TRUNC(m.MEM_FECHA_VENCIMIENTO) >= TRUNC(SYSDATE)
                        ) THEN 0
                   WHEN m.MEM_FECHA_VENCIMIENTO IS NOT NULL
                        AND TRUNC(m.MEM_FECHA_VENCIMIENTO) >= TRUNC(SYSDATE) THEN 1
                   WHEN LOWER(NVL(em.EME_ESTADO, '')) LIKE '%venc%' THEN 2
                   ELSE 3
                 END,
                 NVL(m.MEM_FECHA_VENCIMIENTO, DATE '1900-01-01') DESC,
                 m.MEM_ID DESC
             ) AS RN
        FROM PAR_MEMBRESIA m
        LEFT JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
    ) ranked
   WHERE ranked.RN = 1
) mem ON mem.VEH_ID = v.VEH_ID`;

const LIST_SELECT = `SELECT v.VEH_ID, v.VEH_PLACA,
              ${vehiculoCatalogSelect('v')},
              v.CLI_ID,
              mem.MEM_ID, mem.MEM_FECHA_INICIO, mem.MEM_FECHA_VENCIMIENTO,
              mem.EME_ID, mem.EME_ESTADO
         FROM PAR_VEHICULO v
         ${vehiculoCatalogJoin('v')}
         ${VEHICULO_MEMBRESIA_RESUMEN_JOIN}`;

const EXISTS_TICKET_CLIENT = `EXISTS (
  SELECT 1
    FROM PAR_VEHICULO vx
    JOIN PAR_TICKET t ON t.VEH_ID = vx.VEH_ID
   WHERE vx.CLI_ID = v.CLI_ID
)`;

const EXISTS_MEMBERSHIP_CLIENT = `EXISTS (
  SELECT 1
    FROM PAR_VEHICULO vx
    JOIN PAR_MEMBRESIA m ON m.VEH_ID = vx.VEH_ID
   WHERE vx.CLI_ID = v.CLI_ID
)`;

const IS_VEHICULO_CLIENTE_ESPORADICO = `(${EXISTS_TICKET_CLIENT} AND NOT ${EXISTS_MEMBERSHIP_CLIENT})`;
const WHERE_TICKETS_ESPORADICOS = `WHERE v.CLI_ID IS NULL OR (v.CLI_ID IS NOT NULL AND ${IS_VEHICULO_CLIENTE_ESPORADICO})`;
const WHERE_CLIENTE_CON_MEMBRESIA = `WHERE v.CLI_ID IS NOT NULL AND NOT ${IS_VEHICULO_CLIENTE_ESPORADICO}`;

export async function getAll(options = {}) {
  if (options.soloClienteConMembresia) {
    return executeSql(`${LIST_SELECT} ${WHERE_CLIENTE_CON_MEMBRESIA} ORDER BY v.VEH_ID`);
  }
  if (options.soloEsporadicos) {
    return executeSql(`${LIST_SELECT} ${WHERE_TICKETS_ESPORADICOS} ORDER BY v.VEH_ID`);
  }
  return executeSql(`${LIST_SELECT} ORDER BY v.VEH_ID`);
}

export async function getById(id) {
  const rows = await executeSql(`${LIST_SELECT} WHERE v.VEH_ID = :id`, { id });
  return rows[0] || null;
}

export async function findByPlaca(placa, excludeId = null) {
  if (!placa) return null;
  const normalizedPlaca = normalizePlate(placa);
  const rows = await executeSql(
    `SELECT VEH_ID, VEH_PLACA
       FROM PAR_VEHICULO
      WHERE UPPER(VEH_PLACA) = UPPER(:placa)
        AND (:excludeId IS NULL OR VEH_ID <> :excludeId)`,
    { placa: normalizedPlaca, excludeId }
  );
  return rows[0] || null;
}

async function isIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_VEHICULO' AND COLUMN_NAME='VEH_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function ensureModeloExists(modId) {
  const rows = await executeSql(
    `SELECT MOD_ID
       FROM PAR_MODELO_VEHICULO
      WHERE MOD_ID = :id`,
    { id: modId }
  );
  if (!rows[0]) throw new Error('MOD_ID no valido');
}

async function ensureColorExists(colId) {
  if (colId == null || String(colId).trim() === '') return;
  const rows = await executeSql(
    `SELECT COL_ID
       FROM PAR_COLOR_VEHICULO
      WHERE COL_ID = :id`,
    { id: colId }
  );
  if (!rows[0]) throw new Error('COL_ID no valido');
}

export async function create(data) {
  const placa = assertValidPlate(data.VEH_PLACA);
  const existingPlaca = await findByPlaca(placa);
  if (existingPlaca) throw new Error('Ya existe un vehiculo con la misma placa.');
  if (!data.MOD_ID) throw new Error('MOD_ID es requerido');
  await ensureModeloExists(data.MOD_ID);
  await ensureColorExists(data.COL_ID);

  if ((await isIdentityAlways()) || !data.VEH_ID) {
    await executeSql(
      `INSERT INTO PAR_VEHICULO (VEH_PLACA, MOD_ID, COL_ID, CLI_ID)
       VALUES (:VEH_PLACA, :MOD_ID, :COL_ID, :CLI_ID)`,
      {
        VEH_PLACA: placa,
        MOD_ID: data.MOD_ID ?? null,
        COL_ID: data.COL_ID ?? null,
        CLI_ID: data.CLI_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT VEH_ID
         FROM PAR_VEHICULO
        WHERE UPPER(VEH_PLACA) = UPPER(:placa)
        ORDER BY VEH_ID DESC`,
      { placa }
    );
    return rows[0] ? getById(rows[0].VEH_ID) : null;
  }

  await executeSql(
    `INSERT INTO PAR_VEHICULO (VEH_ID, VEH_PLACA, MOD_ID, COL_ID, CLI_ID)
     VALUES (:VEH_ID, :VEH_PLACA, :MOD_ID, :COL_ID, :CLI_ID)`,
    {
      VEH_ID: data.VEH_ID ?? null,
      VEH_PLACA: placa,
      MOD_ID: data.MOD_ID ?? null,
      COL_ID: data.COL_ID ?? null,
      CLI_ID: data.CLI_ID ?? null,
    },
    { autoCommit: true }
  );
  return getById(data.VEH_ID);
}

export async function update(id, data) {
  const placa = assertValidPlate(data.VEH_PLACA);
  const existingPlaca = await findByPlaca(placa, id);
  if (existingPlaca) throw new Error('Ya existe otro vehiculo con la misma placa.');
  if (!data.MOD_ID) throw new Error('MOD_ID es requerido');
  await ensureModeloExists(data.MOD_ID);
  await ensureColorExists(data.COL_ID);
  await executeSql(
    `UPDATE PAR_VEHICULO
        SET VEH_PLACA = :VEH_PLACA,
            MOD_ID = :MOD_ID,
            COL_ID = :COL_ID,
            CLI_ID = :CLI_ID
      WHERE VEH_ID = :id`,
    {
      id,
      VEH_PLACA: placa,
      MOD_ID: data.MOD_ID ?? null,
      COL_ID: data.COL_ID ?? null,
      CLI_ID: data.CLI_ID ?? null,
    },
    { autoCommit: true }
  );
  return getById(id);
}
