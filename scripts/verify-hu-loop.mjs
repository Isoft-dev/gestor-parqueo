/**
 * Loop de verificación HU para detectar flakiness.
 *
 * Uso (desde carpeta server):
 *   ITERATIONS=20 SEED_EACH=0 node scripts/verify-hu-loop.mjs
 *   ITERATIONS=10 SEED_EACH=1 node scripts/verify-hu-loop.mjs
 *
 * - ITERATIONS: número de corridas (default 10)
 * - SEED_EACH: si es "1", ejecuta db:seed-demo antes de cada corrida (default 0)
 */
import { spawnSync } from 'child_process';

function envFlag(name, def = '0') {
  const v = String(process.env[name] ?? def).trim();
  return v === '1' || v.toLowerCase() === 'true' || v.toLowerCase() === 'yes';
}

function envInt(name, def) {
  const v = Number.parseInt(String(process.env[name] ?? def), 10);
  return Number.isFinite(v) && v > 0 ? v : def;
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: 'inherit', shell: true });
  return r.status ?? 1;
}

async function main() {
  const iterations = envInt('ITERATIONS', 10);
  const seedEach = envFlag('SEED_EACH', '0');

  console.log(`\n--- HU loop ---\nITERATIONS=${iterations} SEED_EACH=${seedEach ? 1 : 0}\n`);

  const startedAt = Date.now();
  for (let i = 1; i <= iterations; i += 1) {
    console.log(`\n=== Corrida ${i}/${iterations} ===\n`);

    if (seedEach) {
      const s = run('node', ['scripts/run-seed-demo.mjs']);
      if (s !== 0) {
        console.error(`\nFALLO seed en corrida ${i} (exit ${s})\n`);
        process.exit(s);
      }
    }

    const v = run('node', ['scripts/verify-hu-api.mjs']);
    if (v !== 0) {
      console.error(`\nFALLO verify en corrida ${i} (exit ${v})\n`);
      process.exit(v);
    }
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(`\nOK: ${iterations}/${iterations} corridas pasaron (elapsed ${Math.round(elapsedMs / 1000)}s)\n`);
}

main().catch((e) => {
  console.error('FALLO:', e?.message || e);
  process.exit(1);
});

