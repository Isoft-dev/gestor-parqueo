/**
 * Comprueba que el esquema Oracle del usuario coincide con PAR_ENTIDADES.sql
 * (tablas PAR_*, columnas IDENTITY en PKs, columnas críticas para seeds/HU).
 *
 * Uso (desde carpeta server): node scripts/verify-schema-par.mjs
 * Requiere ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECT_STRING en server/.env
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import oracledb from 'oracledb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;

/** Tablas y PK esperadas según PAR_ENTIDADES.sql (GENERATED ALWAYS AS IDENTITY en la PK). */
const EXPECTED_IDENTITY_PK = [
  ['PAR_TIPO_VEHICULO', 'TVE_ID'],
  ['PAR_MARCA_VEHICULO', 'MAR_ID'],
  ['PAR_COLOR_VEHICULO', 'COL_ID'],
  ['PAR_MODELO_VEHICULO', 'MOD_ID'],
  ['PAR_CLIENTE', 'CLI_ID'],
  ['PAR_VEHICULO', 'VEH_ID'],
  ['PAR_ESTADO_TICKET', 'ETI_ID'],
  ['PAR_TIPO_COBRO', 'TCO_ID'],
  ['PAR_TARIFA', 'TAR_ID'],
  ['PAR_TICKET', 'TIC_ID'],
  ['PAR_COBRO', 'COB_ID'],
  ['PAR_TIPO_MAQUINA', 'TMA_ID'],
  ['PAR_ESTADO_MAQUINA', 'EMA_ID'],
  ['PAR_MAQUINA', 'MAQ_ID'],
  ['PAR_DETALLE_MAQUINA_TICKET', 'DMT_ID'],
  ['PAR_SALDO_DISPONIBLE', 'SDI_ID'],
  ['PAR_DETALLE_SALDO', 'DSA_ID'],
  ['PAR_RECARGO_MAQUINA', 'RMA_ID'],
  ['PAR_REGISTRO_MANTENIMIENTO', 'REM_ID'],
  ['PAR_ESTADO_ALERTA', 'EAL_ID'],
  ['PAR_TIPO_ALERTA', 'TAL_ID'],
  ['PAR_ALERTA', 'ALE_ID'],
  ['PAR_INCIDENTE', 'INC_ID'],
  ['PAR_ROL', 'ROL_ID'],
  ['PAR_USUARIO', 'USU_ID'],
  ['PAR_BITACORA_INCIDENTE_VEHICULO', 'BIV_ID'],
  ['PAR_ESTADO_MEMBRESIA', 'EME_ID'],
  ['PAR_TIPO_MEMBRESIA', 'TME_ID'],
  ['PAR_ESTADO_ESPACIO', 'EES_ID'],
  ['PAR_ESPACIO', 'ESP_ID'],
  ['PAR_MEMBRESIA', 'MEM_ID'],
  ['PAR_REGISTRO_MOVIMIENTO_MEMBRESIA', 'RMM_ID'],
  ['PAR_TIPO_PAGO', 'TPA_ID'],
  ['PAR_PAGO', 'PAG_ID'],
  ['PAR_DETALLE_PAGO_MEMBRESIA', 'DPM_ID'],
  ['PAR_TIPO_NOTIFICACION', 'TNO_ID'],
  ['PAR_NOTIFICACION', 'NOT_ID'],
];

/** Columnas que deben existir (nombre exacto según PAR_ENTIDADES.sql). */
const REQUIRED_COLUMNS = [
  ['PAR_TARIFA', 'TAR_TIEMPO_GRACIA'],
  ['PAR_DETALLE_SALDO', 'DSA_UMBRAL_MINIMO'],
];

const EXPECTED_TABLES = [...new Set(EXPECTED_IDENTITY_PK.map(([t]) => t))];

async function main() {
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;
  if (!user || !password || !connectString) {
    console.error('Define ORACLE_USER, ORACLE_PASSWORD y ORACLE_CONNECT_STRING en server/.env');
    process.exit(1);
  }

  const conn = await oracledb.getConnection({ user, password, connectString });
  const issues = [];

  try {
    const banner = await conn.execute(`SELECT BANNER FROM V$VERSION WHERE ROWNUM = 1`);
    const ver = banner.rows?.[0]?.BANNER || '(desconocida)';
    console.log(`Conexión: ${user} @ ${connectString}`);
    console.log(`Oracle: ${ver}\n`);

    const existingTables = await conn.execute(
      `SELECT table_name FROM user_tables WHERE table_name LIKE 'PAR_%' ORDER BY table_name`
    );
    const have = new Set((existingTables.rows || []).map((r) => r.TABLE_NAME));

    for (const t of EXPECTED_TABLES) {
      if (!have.has(t)) {
        issues.push(`Falta tabla: ${t}`);
      }
    }

    let identityCols = [];
    try {
      const idRes = await conn.execute(
        `SELECT table_name, column_name, generation_type
           FROM user_tab_identity_cols
          ORDER BY table_name, column_name`
      );
      identityCols = idRes.rows || [];
    } catch (e) {
      issues.push(
        `No se pudo leer USER_TAB_IDENTITY_COLS (¿Oracle < 12c? o sin permisos): ${e.message}`
      );
    }

    const idKey = new Set(identityCols.map((r) => `${r.TABLE_NAME}.${r.COLUMN_NAME}`));

    for (const [table, col] of EXPECTED_IDENTITY_PK) {
      const key = `${table}.${col}`;
      if (!have.has(table)) continue;
      if (!idKey.has(key)) {
        issues.push(
          `IDENTITY: ${table}.${col} no está en USER_TAB_IDENTITY_COLS (la PK no es GENERATED AS IDENTITY como en PAR_ENTIDADES.sql)`
        );
      } else {
        const row = identityCols.find((r) => r.TABLE_NAME === table && r.COLUMN_NAME === col);
        const gen = row?.GENERATION_TYPE || '';
        if (gen && String(gen).toUpperCase() !== 'ALWAYS') {
          issues.push(
            `IDENTITY: ${table}.${col} tiene GENERATION_TYPE='${gen}' (esperado ALWAYS según PAR_ENTIDADES.sql)`
          );
        }
      }
    }

    for (const [table, col] of REQUIRED_COLUMNS) {
      if (!have.has(table)) continue;
      const r = await conn.execute(
        `SELECT 1 FROM user_tab_columns
          WHERE table_name = :t AND column_name = :c`,
        { t: table, c: col }
      );
      if (!r.rows?.length) {
        issues.push(`Columna faltante: ${table}.${col} (requerida por PAR_ENTIDADES y seeds)`);
      }
    }

    console.log('--- Resumen ---');
    if (issues.length === 0) {
      console.log('OK: el esquema del usuario coincide con lo esperado para PAR_ENTIDADES.sql');
      console.log(`    (${EXPECTED_TABLES.length} tablas PAR_*, PKs con IDENTITY ALWAYS, columnas críticas presentes)`);
      process.exitCode = 0;
    } else {
      console.log(`Se encontraron ${issues.length} problema(s):\n`);
      for (const i of issues) console.log(`  - ${i}`);
      console.log(
        '\nSi creaste las tablas antes de usar IDENTITY, recrea el esquema ejecutando PAR_ENTIDADES.sql en un usuario limpio o migra las columnas PK a GENERATED ALWAYS AS IDENTITY.'
      );
      process.exitCode = 1;
    }
  } finally {
    await conn.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
