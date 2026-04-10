import cron from 'node-cron';
import { runDailyMembershipJobs } from '../services/jobMembershipTasks.js';
import { isOracleConfigured } from '../config.js';
import { insertSystemAlerta } from '../utils/systemAlert.js';

export function startDailyJobs() {
  if (!isOracleConfigured()) {
    console.log('[cron] Oracle no configurado: jobs diarios deshabilitados');
    return;
  }
  const schedule = process.env.CRON_DAILY || '0 8 * * *';
  cron.schedule(
    schedule,
    async () => {
      try {
        const r = await runDailyMembershipJobs();
        console.log('[cron] Membresías:', JSON.stringify(r));
      } catch (e) {
        console.error('[cron] Error jobs membresía:', e?.message || e);
        await insertSystemAlerta({
          motivo: 'Error proceso automático diario (membresías)',
          descripcion: String(e?.stack || e?.message || e).slice(0, 3500),
        });
      }
    },
    { timezone: process.env.CRON_TZ || undefined },
  );
  console.log(`[cron] Jobs diarios programados (${schedule}). Variable CRON_DAILY para cambiar.`);
}
