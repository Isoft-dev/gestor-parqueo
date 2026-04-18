import { executeProcedure, executeSql } from '../db/oracle.js';

export async function getAll() {
  return executeSql(
    `SELECT b.BIV_ID, b.BIV_DESCRIPCION, b.BIV_FECHA_HORA,
            b.VEH_ID, v.VEH_PLACA, v.VEH_MODELO, v.CLI_ID,
            c.CLI_PRIMER_NOMBRE, c.CLI_PRIMER_APELLIDO, c.CLI_CORREO,
            b.INC_ID, i.INC_TIPO, i.INC_DESCRIPCION,
            b.BIV_RESUELTO, b.BIV_FECHA_RESOLUCION,
            b.USU_ID, u.USU_PRIMER_NOMBRE, u.USU_PRIMER_APELLIDO
       FROM PAR_BITACORA_INCIDENTE_VEHICULO b
       JOIN PAR_VEHICULO v ON b.VEH_ID = v.VEH_ID
       JOIN PAR_INCIDENTE i ON b.INC_ID = i.INC_ID
       LEFT JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
       LEFT JOIN PAR_USUARIO u ON b.USU_ID = u.USU_ID
      ORDER BY b.BIV_FECHA_HORA DESC`
  );
}

export async function getById(id) {
  const rows = await executeSql(
    `SELECT b.BIV_ID, b.BIV_DESCRIPCION, b.BIV_FECHA_HORA,
            b.VEH_ID, v.VEH_PLACA, v.VEH_MODELO, v.CLI_ID,
            c.CLI_PRIMER_NOMBRE, c.CLI_PRIMER_APELLIDO, c.CLI_CORREO,
            b.INC_ID, i.INC_TIPO, i.INC_DESCRIPCION,
            b.BIV_RESUELTO, b.BIV_FECHA_RESOLUCION,
            b.USU_ID, u.USU_PRIMER_NOMBRE, u.USU_PRIMER_APELLIDO
       FROM PAR_BITACORA_INCIDENTE_VEHICULO b
       JOIN PAR_VEHICULO v ON b.VEH_ID = v.VEH_ID
       JOIN PAR_INCIDENTE i ON b.INC_ID = i.INC_ID
       LEFT JOIN PAR_CLIENTE c ON c.CLI_ID = v.CLI_ID
       LEFT JOIN PAR_USUARIO u ON b.USU_ID = u.USU_ID
      WHERE b.BIV_ID = :id`,
    { id }
  );
  return rows[0] || null;
}

export async function create(data) {
  const identity = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_BITACORA_INCIDENTE_VEHICULO' AND COLUMN_NAME='BIV_ID'`
  );
  const useIdentity = String(identity[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS' || !data.BIV_ID;
  if (useIdentity) {
    await executeSql(
      `INSERT INTO PAR_BITACORA_INCIDENTE_VEHICULO
        (BIV_DESCRIPCION, BIV_FECHA_HORA, VEH_ID, INC_ID, BIV_RESUELTO, BIV_FECHA_RESOLUCION, USU_ID)
       VALUES
        (:BIV_DESCRIPCION, :BIV_FECHA_HORA, :VEH_ID, :INC_ID, :BIV_RESUELTO, :BIV_FECHA_RESOLUCION, :USU_ID)`,
      {
        BIV_DESCRIPCION: data.BIV_DESCRIPCION ?? null,
        BIV_FECHA_HORA: data.BIV_FECHA_HORA ? new Date(data.BIV_FECHA_HORA) : new Date(),
        VEH_ID: data.VEH_ID ?? null,
        INC_ID: data.INC_ID ?? null,
        BIV_RESUELTO: data.BIV_RESUELTO ?? 0,
        BIV_FECHA_RESOLUCION: data.BIV_FECHA_RESOLUCION ? new Date(data.BIV_FECHA_RESOLUCION) : null,
        USU_ID: data.USU_ID ?? null,
      },
      { autoCommit: true }
    );
    const rows = await executeSql(
      `SELECT BIV_ID FROM PAR_BITACORA_INCIDENTE_VEHICULO
        WHERE VEH_ID = :vehId AND INC_ID = :incId
        ORDER BY BIV_ID DESC`,
      { vehId: data.VEH_ID ?? null, incId: data.INC_ID ?? null }
    );
    return rows[0] ? getById(rows[0].BIV_ID) : null;
  }
  await executeProcedure(
    `BEGIN SP_BITACORA_INC_VEH_CREATE(:BIV_ID, :BIV_DESCRIPCION, :BIV_FECHA_HORA, :VEH_ID, :INC_ID, :BIV_RESUELTO, :BIV_FECHA_RESOLUCION, :USU_ID); END;`,
    {
      BIV_ID: data.BIV_ID ?? null,
      BIV_DESCRIPCION: data.BIV_DESCRIPCION ?? null,
      BIV_FECHA_HORA: data.BIV_FECHA_HORA ? new Date(data.BIV_FECHA_HORA) : new Date(),
      VEH_ID: data.VEH_ID ?? null,
      INC_ID: data.INC_ID ?? null,
      BIV_RESUELTO: data.BIV_RESUELTO ?? 0,
      BIV_FECHA_RESOLUCION: data.BIV_FECHA_RESOLUCION ? new Date(data.BIV_FECHA_RESOLUCION) : null,
      USU_ID: data.USU_ID ?? null,
    }
  );
  return getById(data.BIV_ID);
}

export async function resolve(id, data) {
  await executeProcedure(
    `BEGIN SP_BITACORA_INC_VEH_RESOLVE(:id, :BIV_RESUELTO, :BIV_FECHA_RESOLUCION, :USU_ID); END;`,
    {
      id,
      BIV_RESUELTO: data.BIV_RESUELTO ?? 1,
      BIV_FECHA_RESOLUCION: data.BIV_FECHA_RESOLUCION ? new Date(data.BIV_FECHA_RESOLUCION) : new Date(),
      USU_ID: data.USU_ID ?? null,
    }
  );
  return getById(id);
}
