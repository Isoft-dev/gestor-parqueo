import 'dotenv/config';
import { closePool, getConnection } from '../db/oracle.js';
import { ensureClienteFromTicketNitTx } from '../services/cliente.js';

async function main() {
  let conn;
  try {
    conn = await getConnection();
    const rows = await conn.execute(
      `SELECT c.COB_ID, c.TIC_ID, c.COB_NIT, t.VEH_ID
         FROM PAR_COBRO c
         JOIN PAR_TICKET t ON t.TIC_ID = c.TIC_ID
         JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
        WHERE c.COB_NIT IS NOT NULL
          AND TRIM(UPPER(c.COB_NIT)) <> 'CF'
          AND v.CLI_ID IS NULL
        ORDER BY c.COB_ID`
    );

    let repaired = 0;
    let created = 0;
    let skipped = 0;

    for (const row of rows.rows || []) {
      const result = await ensureClienteFromTicketNitTx(conn, {
        useCf: false,
        cobNit: row.COB_NIT,
        vehId: row.VEH_ID,
        ticId: row.TIC_ID,
      });
      if (result?.omitido) {
        skipped += 1;
        continue;
      }
      repaired += 1;
      if (result?.clienteNuevo) created += 1;
    }

    await conn.commit();
    console.log(
      `OK: vehículos vinculados por NIT=${repaired}, clientes esporádicos creados=${created}, omitidos=${skipped}`
    );
  } catch (err) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    console.error(`ERROR: ${err?.message || err}`);
    process.exitCode = 1;
  } finally {
    if (conn) await conn.close();
    await closePool();
  }
}

main();
