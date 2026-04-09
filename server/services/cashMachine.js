const DENOMS_GTQ = [50, 20, 10, 5];

/**
 * Carga billetes por denominación (valor Q) para una máquina.
 * @returns {Record<number, { dsaId: number, cantidad: number, sdiValor: number }>}
 */
export async function loadDetalleByMachineTx(conn, maqId) {
  const r = await conn.execute(
    `SELECT ds.DSA_ID, ds.DSA_CANTIDAD, ds.DSA_SUBTOTAL, sd.SDI_VALOR
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON sd.SDI_ID = ds.SDI_ID
      WHERE ds.MAQ_ID = :maqId
      ORDER BY sd.SDI_VALOR DESC`,
    { maqId }
  );
  const byVal = {};
  for (const row of r.rows || []) {
    const v = Number(row.SDI_VALOR);
    if (!DENOMS_GTQ.includes(v)) continue;
    byVal[v] = {
      dsaId: row.DSA_ID,
      cantidad: Math.floor(Number(row.DSA_CANTIDAD || 0)),
      sdiValor: v,
    };
  }
  return byVal;
}

function greedyChange(vuelto, inventoryByVal) {
  let remaining = Math.round(Number(vuelto) * 100) / 100;
  const plan = {};
  for (const d of DENOMS_GTQ) {
    const slot = inventoryByVal[d];
    if (!slot) continue;
    const need = Math.floor(remaining / d + 1e-9);
    const take = Math.min(need, slot.cantidad);
    if (take > 0) {
      plan[d] = take;
      remaining = Math.round((remaining - take * d) * 100) / 100;
    }
  }
  if (remaining > 0.02) {
    return { ok: false, plan: null, remaining };
  }
  return { ok: true, plan, remaining: 0 };
}

/**
 * Aplica vuelto (resta billetes de la máquina) e ingreso del cliente (suma billetes).
 * `ingresoPorValor`: { 5: n, 10: n, ... } opcional; si se omite solo se descuenta vuelto.
 */
export async function applyCashMovementTx(conn, { maqId, vuelto, ingresoPorValor = null }) {
  const inv = await loadDetalleByMachineTx(conn, maqId);
  const v = Number(vuelto);
  if (v < 0) throw new Error('Vuelto inválido');

  if (v > 0.02) {
    const { ok, plan, remaining } = greedyChange(v, inv);
    if (!ok) {
      // HU Viviana: si no hay efectivo suficiente para el vuelto, bloquear y generar alerta.
      try {
        const { insertMachineAlerta } = await import('../utils/systemAlert.js');
        await insertMachineAlerta({
          maqId,
          motivo: 'Saldo insuficiente para vuelto',
          descripcion: `Falta Q${Number(remaining).toFixed(2)} para completar vuelto de Q${Number(v).toFixed(2)}`,
          preferSaldoBajo: true,
        });
      } catch {
        // Si la alerta falla, igual se debe bloquear la transacción.
      }
      throw new Error(
        `No hay efectivo suficiente en la máquina para dar vuelto (falta Q${Number(remaining).toFixed(2)})`
      );
    }
    for (const d of DENOMS_GTQ) {
      const cnt = plan[d];
      if (!cnt) continue;
      const slot = inv[d];
      const nueva = slot.cantidad - cnt;
      const sub = nueva * d;
      await conn.execute(
        `UPDATE PAR_DETALLE_SALDO
            SET DSA_CANTIDAD = :c, DSA_SUBTOTAL = :s
          WHERE DSA_ID = :id`,
        { c: nueva, s: sub, id: slot.dsaId }
      );
    }
  }

  if (ingresoPorValor && typeof ingresoPorValor === 'object') {
    const inv2 = await loadDetalleByMachineTx(conn, maqId);
    for (const d of DENOMS_GTQ) {
      const add = Math.floor(Number(ingresoPorValor[d] || ingresoPorValor[String(d)] || 0));
      if (add <= 0) continue;
      const slot = inv2[d];
      if (!slot) {
        throw new Error(`La máquina no tiene denominación Q${d} configurada en PAR_DETALLE_SALDO`);
      }
      const nueva = slot.cantidad + add;
      const sub = nueva * d;
      await conn.execute(
        `UPDATE PAR_DETALLE_SALDO
            SET DSA_CANTIDAD = :c, DSA_SUBTOTAL = :s
          WHERE DSA_ID = :id`,
        { c: nueva, s: sub, id: slot.dsaId }
      );
    }
  }

  try {
    await evaluateLowBalanceAlertTx(conn, maqId);
  } catch (e) {
    const { insertSystemAlerta } = await import('../utils/systemAlert.js');
    await insertSystemAlerta({
      motivo: 'Error actualizando balance / alerta saldo bajo',
      descripcion: `MAQ_ID ${maqId}: ${e?.message || e}`,
    });
  }
}

async function evaluateLowBalanceAlertTx(conn, maqId) {
  const hasUmbral = await conn.execute(
    `SELECT COUNT(*) AS CNT
       FROM USER_TAB_COLUMNS
      WHERE TABLE_NAME = 'PAR_DETALLE_SALDO' AND COLUMN_NAME = 'DSA_UMBRAL_MINIMO'`
  );
  if (Number(hasUmbral.rows?.[0]?.CNT || 0) === 0) return;

  const rows = await conn.execute(
    `SELECT ds.DSA_CANTIDAD, ds.DSA_UMBRAL_MINIMO, sd.SDI_VALOR
       FROM PAR_DETALLE_SALDO ds
       JOIN PAR_SALDO_DISPONIBLE sd ON sd.SDI_ID = ds.SDI_ID
      WHERE ds.MAQ_ID = :maqId`,
    { maqId }
  );

  const eal = await conn.execute(
    `SELECT EAL_ID FROM PAR_ESTADO_ALERTA
      WHERE LOWER(EAL_ESTADO) LIKE '%pend%'
      ORDER BY EAL_ID FETCH FIRST 1 ROW ONLY`
  );
  let tal = await conn.execute(
    `SELECT TAL_ID FROM PAR_TIPO_ALERTA
      WHERE LOWER(TAL_TIPO) LIKE '%saldo%baj%'
         OR LOWER(TAL_TIPO) LIKE '%bajo%saldo%'
         OR LOWER(NVL(TAL_DESCRIPCION, '')) LIKE '%saldo%baj%'
      ORDER BY TAL_ID FETCH FIRST 1 ROW ONLY`,
  );
  let talId = tal.rows?.[0]?.TAL_ID ?? tal.rows?.[0]?.tal_id;
  if (talId == null) {
    tal = await conn.execute(
      `SELECT TAL_ID FROM PAR_TIPO_ALERTA ORDER BY TAL_ID FETCH FIRST 1 ROW ONLY`,
    );
    talId = tal.rows?.[0]?.TAL_ID ?? tal.rows?.[0]?.tal_id;
  }
  const ealId = eal.rows?.[0]?.EAL_ID ?? eal.rows?.[0]?.eal_id;
  if (!ealId || !talId) return;

  for (const row of rows.rows || []) {
    const cant = Number(row.DSA_CANTIDAD || 0);
    const umb = row.DSA_UMBRAL_MINIMO != null ? Number(row.DSA_UMBRAL_MINIMO) : null;
    if (umb == null || umb < 0) continue;
    if (cant > umb) continue;

    const motivo = 'Saldo bajo en máquina de cobro';
    const desc = `Denominación Q${row.SDI_VALOR}: ${cant} billetes (umbral ${umb})`;
    await conn.execute(
      `INSERT INTO PAR_ALERTA
        (MAQ_ID, ALE_MOTIVO, ALE_DESCRIPCION, ALE_FECHA_HORA_GENERACION, EAL_ID, TAL_ID, ALE_FECHA_ATENCION)
       VALUES
        (:maqId, :motivo, :desc, SYSDATE, :ealId, :talId, NULL)`,
      { maqId, motivo, desc, ealId, talId }
    );
  }
}

export { DENOMS_GTQ, greedyChange };
