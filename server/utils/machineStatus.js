function normMachineStatusText(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export function isMachineStatusOperativeName(value) {
  const x = normMachineStatusText(value);
  if (!x) return false;
  if (x.includes('fuera') && x.includes('servicio')) return false;
  if (x.includes('manten')) return false;
  if (x.includes('inoper')) return false;
  if (x.includes('desactiv')) return false;
  if (x.includes('pendiente') && x.includes('activ')) return false;
  return (
    x.includes('operativ')
    || x.includes('habilitad')
    || x === 'activa'
    || (x.includes('en') && x.includes('servicio'))
  );
}

export function isMachineStatusMaintenanceName(value) {
  const x = normMachineStatusText(value);
  return x.includes('manten') || x.includes('revision') || (x.includes('servicio') && x.includes('tecnic'));
}

export function isMachineStatusOutOfServiceName(value) {
  const x = normMachineStatusText(value);
  return (
    (x.includes('fuera') && x.includes('servicio'))
    || x.includes('no disponible')
    || x.includes('averiad')
  );
}

export function isMachineStatusInoperativeName(value) {
  const x = normMachineStatusText(value);
  return (
    x.includes('inoper')
    || x.includes('desactiv')
    || (x.includes('pendiente') && x.includes('activ'))
    || (x.includes('sin') && x.includes('activar'))
  );
}

async function listMachineStatusesTx(conn) {
  const rows = await conn.execute(
    `SELECT EMA_ID, EMA_ESTADO, EMA_DESCRIPCION
       FROM PAR_ESTADO_MAQUINA
      ORDER BY EMA_ID`
  );
  return rows.rows || [];
}

async function isMachineStatusIdentityAlwaysTx(conn) {
  const rows = await conn.execute(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_ESTADO_MAQUINA' AND COLUMN_NAME='EMA_ID'`
  );
  return String(rows.rows?.[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

async function getNextMachineStatusIdTx(conn) {
  const rows = await conn.execute(`SELECT NVL(MAX(EMA_ID), 0) + 1 AS NEXT_ID FROM PAR_ESTADO_MAQUINA`);
  return Number(rows.rows?.[0]?.NEXT_ID || 1);
}

async function insertMachineStatusTx(conn, { estado, descripcion }) {
  if (await isMachineStatusIdentityAlwaysTx(conn)) {
    await conn.execute(
      `INSERT INTO PAR_ESTADO_MAQUINA (EMA_ESTADO, EMA_DESCRIPCION)
       VALUES (:estado, :descripcion)`,
      { estado, descripcion: descripcion ?? null }
    );
  } else {
    const nextId = await getNextMachineStatusIdTx(conn);
    await conn.execute(
      `INSERT INTO PAR_ESTADO_MAQUINA (EMA_ID, EMA_ESTADO, EMA_DESCRIPCION)
       VALUES (:id, :estado, :descripcion)`,
      { id: nextId, estado, descripcion: descripcion ?? null }
    );
  }

  const rows = await conn.execute(
    `SELECT EMA_ID, EMA_ESTADO, EMA_DESCRIPCION
       FROM PAR_ESTADO_MAQUINA
      WHERE EMA_ESTADO = :estado
      ORDER BY EMA_ID DESC`,
    { estado }
  );
  return rows.rows?.[0] || null;
}

async function ensureMachineStatusTx(conn, { matcher, estado, descripcion }) {
  const rows = await listMachineStatusesTx(conn);
  const existing = rows.find((row) => matcher(row.EMA_ESTADO));
  if (existing?.EMA_ID != null) return existing.EMA_ID;
  const created = await insertMachineStatusTx(conn, { estado, descripcion });
  return created?.EMA_ID ?? null;
}

export async function ensureInoperativeMachineStatusIdTx(conn) {
  return ensureMachineStatusTx(conn, {
    matcher: isMachineStatusInoperativeName,
    estado: 'Inoperativa',
    descripcion: 'Creada pero aun no activada para operar',
  });
}

export async function ensureMaintenanceMachineStatusIdTx(conn) {
  return ensureMachineStatusTx(conn, {
    matcher: isMachineStatusMaintenanceName,
    estado: 'Mantenimiento',
    descripcion: 'Mantenimiento programado o correctivo',
  });
}

export async function getMachineStatusByIdTx(conn, emaId) {
  const rows = await conn.execute(
    `SELECT EMA_ID, EMA_ESTADO, EMA_DESCRIPCION
       FROM PAR_ESTADO_MAQUINA
      WHERE EMA_ID = :emaId`,
    { emaId }
  );
  return rows.rows?.[0] || null;
}

export async function getMachineWithStatusTx(conn, maqId) {
  const rows = await conn.execute(
    `SELECT m.MAQ_ID, m.MAQ_CODIGO,
            m.TMA_ID, tm.TMA_TIPO,
            m.EMA_ID, em.EMA_ESTADO, em.EMA_DESCRIPCION
       FROM PAR_MAQUINA m
       JOIN PAR_TIPO_MAQUINA tm ON tm.TMA_ID = m.TMA_ID
       JOIN PAR_ESTADO_MAQUINA em ON em.EMA_ID = m.EMA_ID
      WHERE m.MAQ_ID = :maqId`,
    { maqId }
  );
  return rows.rows?.[0] || null;
}

function machineRefLabel(machine) {
  const code = String(machine?.MAQ_CODIGO ?? '').trim();
  if (code) return code;
  return `MAQ_ID ${machine?.MAQ_ID ?? '?'}`;
}

export function assertMachineIsOperative(machine, usageLabel) {
  if (!machine) throw new Error('Maquina no encontrada');
  if (isMachineStatusOperativeName(machine.EMA_ESTADO)) return;
  const ref = machineRefLabel(machine);
  const estado = String(machine.EMA_ESTADO || 'Sin estado').trim();
  throw new Error(`La maquina ${ref} esta en estado ${estado} y no puede usarse para ${usageLabel}`);
}

export function assertMachineIsInMaintenance(machine, usageLabel) {
  if (!machine) throw new Error('Maquina no encontrada');
  if (isMachineStatusMaintenanceName(machine.EMA_ESTADO)) return;
  const ref = machineRefLabel(machine);
  const estado = String(machine.EMA_ESTADO || 'Sin estado').trim();
  throw new Error(`La maquina ${ref} esta en estado ${estado} y no puede usarse para ${usageLabel}`);
}

export async function moveMachineToMaintenanceTx(conn, maqId) {
  const machine = await getMachineWithStatusTx(conn, maqId);
  assertMachineIsOperative(machine, 'iniciar mantenimiento');

  const maintenanceId = await ensureMaintenanceMachineStatusIdTx(conn);
  if (maintenanceId == null) {
    throw new Error('No se pudo resolver el estado de mantenimiento para la maquina');
  }

  await conn.execute(
    `UPDATE PAR_MAQUINA
        SET EMA_ID = :emaId
      WHERE MAQ_ID = :maqId`,
    { emaId: maintenanceId, maqId }
  );

  return {
    ...machine,
    EMA_ID: maintenanceId,
    EMA_ESTADO: 'Mantenimiento',
  };
}

export async function setMachineStatusTx(conn, maqId, emaId) {
  const machine = await getMachineWithStatusTx(conn, maqId);
  if (!machine) throw new Error('Maquina no encontrada');

  const status = await getMachineStatusByIdTx(conn, emaId);
  if (!status) throw new Error('Estado de maquina no encontrado');

  await conn.execute(
    `UPDATE PAR_MAQUINA
        SET EMA_ID = :emaId
      WHERE MAQ_ID = :maqId`,
    { emaId, maqId }
  );

  return {
    ...machine,
    EMA_ID: status.EMA_ID,
    EMA_ESTADO: status.EMA_ESTADO,
    EMA_DESCRIPCION: status.EMA_DESCRIPCION,
  };
}

export function assertMaintenanceClosingStatus(status) {
  const estado = status?.EMA_ESTADO;
  if (isMachineStatusOperativeName(estado) || isMachineStatusOutOfServiceName(estado)) {
    return;
  }
  throw new Error('La finalizacion de mantenimiento solo puede dejar la maquina en Operativa o Fuera de servicio');
}
