import { executeSql, executeProcedure } from '../db/oracle.js';
import { insertMachineAlerta } from '../utils/systemAlert.js';
import { isTipoMaquinaCobro } from '../utils/tipoMaquinaRules.js';

async function hasUmbralMinimoColumn() {
  const rows = await executeSql(
    `SELECT COUNT(*) AS CNT
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'PAR_DETALLE_SALDO'
        AND COLUMN_NAME = 'DSA_UMBRAL_MINIMO'`
  );
  return Number(rows[0]?.CNT || 0) > 0;
}

/** Expresión SELECT para umbral: columna real o NULL si el esquema aún no la tiene. */
async function umbralSelectExpr() {
  return (await hasUmbralMinimoColumn())
    ? 'ds.DSA_UMBRAL_MINIMO'
    : 'CAST(NULL AS NUMBER) AS DSA_UMBRAL_MINIMO';
}

export async function getAll() {
  const umbral = await umbralSelectExpr();
  return executeSql(
    `SELECT ds.DSA_ID, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL, ${umbral},
            ds.SDI_ID, sd.SDI_TIPO, sd.SDI_VALOR,
            ds.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON ds.SDI_ID = sd.SDI_ID
       JOIN PAR_MAQUINA m ON ds.MAQ_ID = m.MAQ_ID
      ORDER BY ds.MAQ_ID, ds.SDI_ID`
  );
}

export async function getById(id) {
  const umbral = await umbralSelectExpr();
  const rows = await executeSql(
    `SELECT ds.DSA_ID, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL, ${umbral},
            ds.SDI_ID, sd.SDI_TIPO, sd.SDI_VALOR,
            ds.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON ds.SDI_ID = sd.SDI_ID
       JOIN PAR_MAQUINA m ON ds.MAQ_ID = m.MAQ_ID
      WHERE ds.DSA_ID = :id`,
    { id }
  );
  return rows[0] || null;
}

async function assertMaquinaTipoCobro(maqId) {
  const rows = await executeSql(
    `SELECT m.MAQ_ID, tm.TMA_TIPO
       FROM PAR_MAQUINA m
       JOIN PAR_TIPO_MAQUINA tm ON m.TMA_ID = tm.TMA_ID
      WHERE m.MAQ_ID = :maqId`,
    { maqId }
  );
  const t = rows[0]?.TMA_TIPO;
  if (!t || !isTipoMaquinaCobro(t)) {
    throw new Error(
      'El detalle de saldo solo aplica a máquinas cuyo tipo (TMA_TIPO) sea de cobro.'
    );
  }
}

export async function create(data) {
  await assertMaquinaTipoCobro(data.MAQ_ID);

  const sdiRows = await executeSql(
    `SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = :id`,
    { id: data.SDI_ID ?? null }
  );
  const valorUnit = Number(sdiRows[0]?.SDI_VALOR ?? 0);
  const cantidad = Number(data.DSA_CANTIDAD ?? 0);
  const subtotalCalc = Number((valorUnit * cantidad).toFixed(2));

  const withUmbral = await hasUmbralMinimoColumn();
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_DETALLE_SALDO' AND COLUMN_NAME='DSA_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.DSA_ID;

  let umbralMin = null;
  if (withUmbral) {
    umbralMin =
      data.DSA_UMBRAL_MINIMO != null && data.DSA_UMBRAL_MINIMO !== ''
        ? Number(data.DSA_UMBRAL_MINIMO)
        : null;
  }

  if (useIdentity) {
    if (withUmbral) {
      await executeSql(
        `INSERT INTO PAR_DETALLE_SALDO (DSA_CANTIDAD, DSA_SUBTOTAL, DSA_UMBRAL_MINIMO, SDI_ID, MAQ_ID)
         VALUES (:DSA_CANTIDAD, :DSA_SUBTOTAL, :DSA_UMBRAL_MINIMO, :SDI_ID, :MAQ_ID)`,
        {
          DSA_CANTIDAD: cantidad,
          DSA_SUBTOTAL: subtotalCalc,
          DSA_UMBRAL_MINIMO: umbralMin,
          SDI_ID: data.SDI_ID ?? null,
          MAQ_ID: data.MAQ_ID ?? null,
        },
        { autoCommit: true }
      );
    } else {
      await executeSql(
        `INSERT INTO PAR_DETALLE_SALDO (DSA_CANTIDAD, DSA_SUBTOTAL, SDI_ID, MAQ_ID)
         VALUES (:DSA_CANTIDAD, :DSA_SUBTOTAL, :SDI_ID, :MAQ_ID)`,
        {
          DSA_CANTIDAD: cantidad,
          DSA_SUBTOTAL: subtotalCalc,
          SDI_ID: data.SDI_ID ?? null,
          MAQ_ID: data.MAQ_ID ?? null,
        },
        { autoCommit: true }
      );
    }
    const rows = await executeSql(
      `SELECT DSA_ID FROM PAR_DETALLE_SALDO
        WHERE MAQ_ID = :maqId AND SDI_ID = :sdiId
        ORDER BY DSA_ID DESC`,
      { maqId: data.MAQ_ID ?? null, sdiId: data.SDI_ID ?? null }
    );
    const created = rows[0] ? await getById(rows[0].DSA_ID) : null;
    let warning = null;
    if (
      created &&
      withUmbral &&
      umbralMin != null &&
      Number.isFinite(umbralMin) &&
      cantidad <= umbralMin
    ) {
      warning =
        `Cantidad (${cantidad}) en o por debajo del umbral mínimo (${umbralMin}). Considere recargar la máquina.`;
      await insertMachineAlerta({
        maqId: data.MAQ_ID,
        motivo: 'Umbral mínimo de billetes',
        descripcion: `DSA_ID ${created.DSA_ID}: cantidad ${cantidad}, umbral ${umbralMin} (SDI_ID ${data.SDI_ID}).`,
        preferSaldoBajo: true,
      });
    }
    return created ? { ...created, warning } : null;
  }
  await executeProcedure(
    `BEGIN SP_DETALLE_SALDO_CREATE(:DSA_ID, :DSA_CANTIDAD, :DSA_SUBTOTAL, :SDI_ID, :MAQ_ID); END;`,
    {
      DSA_ID: data.DSA_ID ?? null,
      DSA_CANTIDAD: cantidad,
      DSA_SUBTOTAL: subtotalCalc,
      SDI_ID: data.SDI_ID ?? null,
      MAQ_ID: data.MAQ_ID ?? null,
    }
  );
  const row = await getById(data.DSA_ID);
  return row ? { ...row, warning: null } : null;
}

export async function getByMachineId(maqId) {
  const umbral = await umbralSelectExpr();
  return executeSql(
    `SELECT ds.DSA_ID, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL, ${umbral},
            ds.SDI_ID, sd.SDI_TIPO, sd.SDI_VALOR,
            ds.MAQ_ID, m.MAQ_CODIGO
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON ds.SDI_ID = sd.SDI_ID
       JOIN PAR_MAQUINA m ON ds.MAQ_ID = m.MAQ_ID
      WHERE ds.MAQ_ID = :maqId
      ORDER BY ds.SDI_ID`,
    { maqId }
  );
}

export async function updateUmbral(id, umbral) {
  if (!(await hasUmbralMinimoColumn())) {
    throw new Error(
      'No existe la columna DSA_UMBRAL_MINIMO en PAR_DETALLE_SALDO. Agréguela en la base para poder guardar umbrales (criterio de la HU de máquinas).'
    );
  }
  await executeSql(
    `UPDATE PAR_DETALLE_SALDO
        SET DSA_UMBRAL_MINIMO = :umbral
      WHERE DSA_ID = :id`,
    { id, umbral },
    { autoCommit: true }
  );
  return getById(id);
}
