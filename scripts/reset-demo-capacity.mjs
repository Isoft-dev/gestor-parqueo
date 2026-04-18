/**
 * Resetea capacidad demo para pruebas repetidas:
 * - Espacios esporádicos (sin membresía) -> estado "disponible"
 * - Espacios de membresía no se tocan
 *
 * Uso (desde carpeta server): node scripts/reset-demo-capacity.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { getConnection } from '../db/oracle.js';
import { resolveParkingStateIdsTx } from '../services/espacioCapacity.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  let conn;
  try {
    conn = await getConnection();
    const { sporadicDisponible } = await resolveParkingStateIdsTx(conn);
    if (sporadicDisponible == null) {
      throw new Error('No se pudo resolver estado esporádico "disponible" en PAR_ESTADO_ESPACIO');
    }

    const r = await conn.execute(
      `UPDATE PAR_ESPACIO e
          SET e.EES_ID = :eesDisponible
        WHERE NOT EXISTS (SELECT 1 FROM PAR_MEMBRESIA m WHERE m.ESP_ID = e.ESP_ID)`,
      { eesDisponible: sporadicDisponible },
    );
    await conn.commit();
    console.log(`OK reset-demo-capacity: ${Number(r.rowsAffected || 0)} espacios esporádicos a disponible`);
  } catch (e) {
    if (conn) {
      try { await conn.rollback(); } catch { /* ignore */ }
    }
    throw e;
  } finally {
    if (conn) await conn.close();
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FALLO:', e?.message || e);
    process.exit(1);
  });

