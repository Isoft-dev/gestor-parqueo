/**
 * Ejecuta inmediatamente los jobs diarios de membresías (sin esperar cron).
 *
 * Uso (desde carpeta server): node scripts/run-membership-jobs-now.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { runDailyMembershipJobs } from '../services/jobMembershipTasks.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

async function main() {
  const r = await runDailyMembershipJobs();
  console.log(JSON.stringify(r, null, 2));
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FALLO:', e?.message || e);
    process.exit(1);
  });

