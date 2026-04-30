import oracledb from 'oracledb';
import { executeCursor, executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll(opts = {}) {
  const mode = String(opts.mode || '').trim().toLowerCase(); // mensual | esporadico | ''
  const qRaw = String(opts.q || '').trim();
  const binds = {};
  const where = [];

  if (mode === 'mensual') {
    // Sin filtro por membresía/vehículo: en admin "Clientes mensuales" debe verse cualquier ficha
    // (alta de cliente, flota sin plan aún, o ya con membresía). El listado esporádico sigue acotado aparte.
  } else if (mode === 'esporadico') {
    where.push(
      `EXISTS (SELECT 1 FROM PAR_VEHICULO v WHERE v.CLI_ID = c.CLI_ID)`
    );
    where.push(
      `NOT EXISTS (
         SELECT 1
           FROM PAR_VEHICULO v
           JOIN PAR_MEMBRESIA m ON m.VEH_ID = v.VEH_ID
          WHERE v.CLI_ID = c.CLI_ID
       )`
    );
  }

  if (qRaw) {
    const q = `%${qRaw.toUpperCase().replace(/\s+/g, ' ')}%`;
    binds.q = q;
    where.push(
      `(
        UPPER(NVL(c.CLI_PRIMER_NOMBRE, '')) LIKE :q
        OR UPPER(NVL(c.CLI_SEGUNDO_NOMBRE, '')) LIKE :q
        OR UPPER(NVL(c.CLI_PRIMER_APELLIDO, '')) LIKE :q
        OR UPPER(NVL(c.CLI_SEGUNDO_APELLIDO, '')) LIKE :q
        OR UPPER(NVL(c.CLI_DPI, '')) LIKE :q
        OR UPPER(
          REGEXP_REPLACE(
            TRIM(
              NVL(c.CLI_PRIMER_NOMBRE, '') || ' ' ||
              NVL(c.CLI_SEGUNDO_NOMBRE, '') || ' ' ||
              NVL(c.CLI_PRIMER_APELLIDO, '') || ' ' ||
              NVL(c.CLI_SEGUNDO_APELLIDO, '')
            ),
            '\\s+',
            ' '
          )
        ) LIKE :q
      )`
    );
  }

  const sql = `SELECT
      c.CLI_ID, c.CLI_PRIMER_NOMBRE, c.CLI_SEGUNDO_NOMBRE,
      c.CLI_PRIMER_APELLIDO, c.CLI_SEGUNDO_APELLIDO,
      c.CLI_DPI, c.CLI_NIT, c.CLI_CORREO, c.CLI_TELEFONO,
      c.CLI_ZONA, c.CLI_CALLE, c.CLI_NUMERO, c.CLI_COLONIA,
      c.CLI_CIUDAD, c.CLI_CODIGO_POSTAL, c.CLI_ACTIVO
    FROM PAR_CLIENTE c
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY c.CLI_ID DESC`;

  return executeSql(sql, binds);
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_CLIENTE_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
  return rows[0] || null;
}

export async function findByDpi(dpi, excludeId = null) {
  if (!dpi) return null;
  const rows = await executeSql(
    `SELECT CLI_ID, CLI_DPI
     FROM PAR_CLIENTE
     WHERE CLI_DPI = :dpi
       AND (:excludeId IS NULL OR CLI_ID <> :excludeId)`,
    { dpi, excludeId }
  );
  return rows[0] || null;
}

export async function hasActiveMemberships(clientId) {
  const rows = await executeSql(
    `SELECT COUNT(*) AS TOTAL
     FROM PAR_MEMBRESIA m
     JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
     LEFT JOIN PAR_ESTADO_MEMBRESIA em ON em.EME_ID = m.EME_ID
     WHERE v.CLI_ID = :clientId
       AND NVL(LOWER(em.EME_ESTADO), 'activa') NOT LIKE '%suspend%'
       AND NVL(LOWER(em.EME_ESTADO), 'activa') NOT LIKE '%inactiv%'`,
    { clientId }
  );
  return Number(rows[0]?.TOTAL || 0) > 0;
}

async function isClienteIdIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME = 'PAR_CLIENTE'
        AND COLUMN_NAME = 'CLI_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  const existingDpi = await findByDpi(data.CLI_DPI);
  if (existingDpi) {
    throw new Error('Ya existe un cliente con el mismo CLI_DPI');
  }

  // Compatibilidad: en algunos entornos CLI_ID es identidad ALWAYS y Oracle no permite insertarlo.
  if ((await isClienteIdIdentityAlways()) || !data.CLI_ID) {
    await executeSql(
      `INSERT INTO PAR_CLIENTE (
        CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
        CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
        CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
        CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO
      ) VALUES (
        :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
        :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
        :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
        :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO, SYSDATE
      )`,
      {
        CLI_PRIMER_NOMBRE: data.CLI_PRIMER_NOMBRE,
        CLI_SEGUNDO_NOMBRE: data.CLI_SEGUNDO_NOMBRE ?? null,
        CLI_PRIMER_APELLIDO: data.CLI_PRIMER_APELLIDO,
        CLI_SEGUNDO_APELLIDO: data.CLI_SEGUNDO_APELLIDO ?? null,
        CLI_DPI: data.CLI_DPI,
        CLI_NIT: data.CLI_NIT ?? null,
        CLI_CORREO: data.CLI_CORREO ?? null,
        CLI_TELEFONO: data.CLI_TELEFONO ?? null,
        CLI_ZONA: data.CLI_ZONA ?? null,
        CLI_CALLE: data.CLI_CALLE ?? null,
        CLI_NUMERO: data.CLI_NUMERO ?? null,
        CLI_COLONIA: data.CLI_COLONIA ?? null,
        CLI_CIUDAD: data.CLI_CIUDAD ?? null,
        CLI_CODIGO_POSTAL: data.CLI_CODIGO_POSTAL ?? null,
        CLI_ACTIVO: data.CLI_ACTIVO ?? 1,
      },
      { autoCommit: true }
    );

    const createdRows = await executeSql(
      `SELECT CLI_ID
         FROM PAR_CLIENTE
        WHERE CLI_DPI = :dpi
        ORDER BY CLI_ID DESC`,
      { dpi: data.CLI_DPI }
    );
    const createdId = createdRows[0]?.CLI_ID;
    return createdId ? getById(createdId) : null;
  }

  await executeProcedure(
    `BEGIN SP_CLIENTE_CREATE(
      :CLI_ID, :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
      :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
      :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
      :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO
    ); END;`,
    {
      CLI_ID: data.CLI_ID,
      CLI_PRIMER_NOMBRE: data.CLI_PRIMER_NOMBRE,
      CLI_SEGUNDO_NOMBRE: data.CLI_SEGUNDO_NOMBRE ?? null,
      CLI_PRIMER_APELLIDO: data.CLI_PRIMER_APELLIDO,
      CLI_SEGUNDO_APELLIDO: data.CLI_SEGUNDO_APELLIDO ?? null,
      CLI_DPI: data.CLI_DPI,
      CLI_NIT: data.CLI_NIT ?? null,
      CLI_CORREO: data.CLI_CORREO ?? null,
      CLI_TELEFONO: data.CLI_TELEFONO ?? null,
      CLI_ZONA: data.CLI_ZONA ?? null,
      CLI_CALLE: data.CLI_CALLE ?? null,
      CLI_NUMERO: data.CLI_NUMERO ?? null,
      CLI_COLONIA: data.CLI_COLONIA ?? null,
      CLI_CIUDAD: data.CLI_CIUDAD ?? null,
      CLI_CODIGO_POSTAL: data.CLI_CODIGO_POSTAL ?? null,
      CLI_ACTIVO: data.CLI_ACTIVO ?? 1,
    }
  );
  return getById(data.CLI_ID);
}

export async function update(id, data) {
  const existingDpi = await findByDpi(data.CLI_DPI, id);
  if (existingDpi) {
    throw new Error('Ya existe otro cliente con el mismo CLI_DPI');
  }
  const willDisable = Number(data.CLI_ACTIVO) === 0;
  if (willDisable && (await hasActiveMemberships(id))) {
    throw new Error('No se puede desactivar un cliente con membresias activas');
  }
  await executeProcedure(
    `BEGIN SP_CLIENTE_UPDATE(
      :id, :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
      :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
      :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
      :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO
    ); END;`,
    {
      id,
      CLI_PRIMER_NOMBRE: data.CLI_PRIMER_NOMBRE,
      CLI_SEGUNDO_NOMBRE: data.CLI_SEGUNDO_NOMBRE ?? null,
      CLI_PRIMER_APELLIDO: data.CLI_PRIMER_APELLIDO,
      CLI_SEGUNDO_APELLIDO: data.CLI_SEGUNDO_APELLIDO ?? null,
      CLI_DPI: data.CLI_DPI,
      CLI_NIT: data.CLI_NIT ?? null,
      CLI_CORREO: data.CLI_CORREO ?? null,
      CLI_TELEFONO: data.CLI_TELEFONO ?? null,
      CLI_ZONA: data.CLI_ZONA ?? null,
      CLI_CALLE: data.CLI_CALLE ?? null,
      CLI_NUMERO: data.CLI_NUMERO ?? null,
      CLI_COLONIA: data.CLI_COLONIA ?? null,
      CLI_CIUDAD: data.CLI_CIUDAD ?? null,
      CLI_CODIGO_POSTAL: data.CLI_CODIGO_POSTAL ?? null,
      CLI_ACTIVO: data.CLI_ACTIVO,
    }
  );
  return getById(id);
}

const NOMBRES_ALEATORIOS = [
  'María', 'José', 'Ana', 'Carlos', 'Lucía', 'Pedro', 'Laura', 'Diego', 'Sofía', 'Miguel',
];
const APELLIDOS_ALEATORIOS = [
  'Morales', 'López', 'Pérez', 'García', 'Ramírez', 'Flores', 'Vásquez', 'Mendoza', 'Ruiz', 'Castillo',
];

function pickAleatorio(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/** Quita tildes y deja solo a-z y 0-9 para el local-part del correo. */
function slugCorreoParte(texto) {
  return String(texto || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/**
 * DPI sintético para factura con NIT: mismos dígitos del NIT + 2 dígitos departamento + 2 municipio (GT).
 * Si el NIT aporta muchos dígitos, se trunca la base para caber en CLI_DPI y conservar siempre los 4 finales.
 */
function buildDpiDesdeNit(nitRegistro, dpiMaxLen = 20) {
  const soloDigitos = String(nitRegistro || '').replace(/\D/g, '');
  const sufijoLen = 4;
  const maxBase = Math.max(1, dpiMaxLen - sufijoLen);
  const baseRaw = soloDigitos.length > 0 ? soloDigitos : '0';
  const base = baseRaw.slice(0, maxBase);
  const depto = String(Math.floor(Math.random() * 22) + 1).padStart(2, '0');
  const muni = String(Math.floor(Math.random() * 99) + 1).padStart(2, '0');
  return `${base}${depto}${muni}`.slice(0, dpiMaxLen);
}

/** Correo tipo nombres.apellidos@gmail.com a partir de nombres elegidos. */
function buildCorreoFacturaAleatorio(primerNombre, primerApellido, segundoApellido) {
  const nombres = slugCorreoParte(primerNombre);
  const apellidos = slugCorreoParte([primerApellido, segundoApellido].filter(Boolean).join(''));
  const local = [nombres, apellidos].filter(Boolean).join('.') || 'cliente.factura';
  return `${local}@gmail.com`.slice(0, 120);
}

/** NIT comparable (solo alfanuméricos en mayúsculas) para buscar duplicados con distinto formato. */
export function normalizeNitComparable(nit) {
  return String(nit || '')
    .trim()
    .toUpperCase()
    .replace(/[^0-9A-Z]/g, '');
}

async function isClienteIdIdentityAlwaysTx(conn) {
  const r = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME = 'PAR_CLIENTE'
        AND COLUMN_NAME = 'CLI_ID'`
  );
  return String(r.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function findClienteIdByNitComparableTx(conn, comparable) {
  if (!comparable) return null;
  const r = await conn.execute(
    `SELECT CLI_ID FROM (
         SELECT CLI_ID FROM PAR_CLIENTE
          WHERE CLI_NIT IS NOT NULL
            AND REGEXP_REPLACE(UPPER(TRIM(CLI_NIT)), '[^0-9A-Z]', '') = :cmp
          ORDER BY CLI_ID DESC
       ) WHERE ROWNUM = 1`,
    { cmp: comparable }
  );
  const id = r.rows?.[0]?.CLI_ID;
  return id != null && String(id).trim() !== '' ? id : null;
}

async function insertClienteFacturaTicketTx(conn, { nitRegistro }) {
  const primerNombre = pickAleatorio(NOMBRES_ALEATORIOS);
  const primerApellido = pickAleatorio(APELLIDOS_ALEATORIOS);
  const segundoApellido = pickAleatorio(APELLIDOS_ALEATORIOS);
  const dpi = buildDpiDesdeNit(nitRegistro);
  const correo = buildCorreoFacturaAleatorio(primerNombre, primerApellido, segundoApellido);

  const binds = {
    CLI_PRIMER_NOMBRE: primerNombre,
    CLI_SEGUNDO_NOMBRE: null,
    CLI_PRIMER_APELLIDO: primerApellido,
    CLI_SEGUNDO_APELLIDO: segundoApellido,
    CLI_DPI: dpi,
    CLI_NIT: nitRegistro,
    CLI_CORREO: correo,
    CLI_TELEFONO: null,
    CLI_ZONA: null,
    CLI_CALLE: null,
    CLI_NUMERO: null,
    CLI_COLONIA: null,
    CLI_CIUDAD: 'Guatemala',
    CLI_CODIGO_POSTAL: null,
    CLI_ACTIVO: 1,
  };

  if (await isClienteIdIdentityAlwaysTx(conn)) {
    const ins = await conn.execute(
      `INSERT INTO PAR_CLIENTE (
          CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
          CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
          CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
          CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO
        ) VALUES (
          :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
          :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
          :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
          :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO, SYSDATE
        )
        RETURNING CLI_ID INTO :outId`,
      {
        ...binds,
        outId: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      }
    );
    const newId = ins.outBinds?.outId?.[0];
    if (newId == null) throw new Error('No se pudo obtener CLI_ID del cliente generado');
    return newId;
  }

  const nxt = await conn.execute(`SELECT NVL(MAX(CLI_ID), 0) + 1 AS N FROM PAR_CLIENTE`);
  const newId = Number(nxt.rows?.[0]?.N || 1);
  await conn.execute(
    `INSERT INTO PAR_CLIENTE (
        CLI_ID, CLI_PRIMER_NOMBRE, CLI_SEGUNDO_NOMBRE,
        CLI_PRIMER_APELLIDO, CLI_SEGUNDO_APELLIDO, CLI_DPI, CLI_NIT,
        CLI_CORREO, CLI_TELEFONO, CLI_ZONA, CLI_CALLE, CLI_NUMERO,
        CLI_COLONIA, CLI_CIUDAD, CLI_CODIGO_POSTAL, CLI_ACTIVO, CLI_FECHA_REGISTRO
      ) VALUES (
        :CLI_ID, :CLI_PRIMER_NOMBRE, :CLI_SEGUNDO_NOMBRE,
        :CLI_PRIMER_APELLIDO, :CLI_SEGUNDO_APELLIDO, :CLI_DPI, :CLI_NIT,
        :CLI_CORREO, :CLI_TELEFONO, :CLI_ZONA, :CLI_CALLE, :CLI_NUMERO,
        :CLI_COLONIA, :CLI_CIUDAD, :CLI_CODIGO_POSTAL, :CLI_ACTIVO, SYSDATE
      )`,
    { CLI_ID: newId, ...binds }
  );
  return newId;
}

/**
 * Cobro con NIT (no CF): reutiliza cliente con el mismo NIT o crea uno con datos aleatorios,
 * y asigna CLI_ID al vehículo del ticket si aún no tenía cliente.
 */
export async function ensureClienteFromTicketNitTx(conn, { useCf, cobNit, vehId, ticId }) {
  if (useCf) return { omitido: true, motivo: 'CF' };
  const nitStr = String(cobNit || '').trim();
  if (!nitStr || nitStr.toUpperCase() === 'CF') return { omitido: true, motivo: 'CF' };
  if (vehId == null || String(vehId).trim() === '') return { omitido: true, motivo: 'SIN_VEHICULO' };

  const vRes = await conn.execute(
    `SELECT CLI_ID FROM PAR_VEHICULO WHERE VEH_ID = :vid FOR UPDATE`,
    { vid: vehId }
  );
  const cliVeh = vRes.rows?.[0]?.CLI_ID;
  if (cliVeh != null && String(cliVeh).trim() !== '') {
    return { omitido: true, motivo: 'VEHICULO_YA_VINCULADO', CLI_ID: cliVeh };
  }

  const comparable = normalizeNitComparable(nitStr);
  if (!comparable) return { omitido: true, motivo: 'NIT_INVALIDO' };

  let cliId = await findClienteIdByNitComparableTx(conn, comparable);
  let clienteNuevo = false;
  if (!cliId) {
    cliId = await insertClienteFacturaTicketTx(conn, { nitRegistro: nitStr });
    clienteNuevo = true;
  }

  await conn.execute(
    `UPDATE PAR_VEHICULO SET CLI_ID = :cid WHERE VEH_ID = :vid`,
    { cid: cliId, vid: vehId }
  );

  return {
    omitido: false,
    CLI_ID: cliId,
    clienteNuevo,
    nitComparable: comparable,
  };
}
