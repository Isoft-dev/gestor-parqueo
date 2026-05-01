/**
 * Verificador "TODO": API + DB + jobs (sin UI).
 *
 * Ejecuta:
 * - verify-hu-api.mjs (API + PDFs + flujos principales)
 * - casos avanzados: efectivo con billetes, vuelto insuficiente (alerta), tiempo de gracia superado (alerta/bloqueo),
 *   pago mensual y jobs diarios (recordatorios + suspensión mora).
 *
 * Uso (desde carpeta server): node scripts/verify-hu-all.mjs
 */
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import oracledb from 'oracledb';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '../.env') });

const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

async function j(method, p, body) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 15000);
  const r = await fetch(`${BASE}${p}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
    signal: ctrl.signal,
  }).finally(() => clearTimeout(t));
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  return { ok: r.ok, status: r.status, data };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runNode(scriptRel) {
  const r = spawnSync('node', [scriptRel], { stdio: 'inherit', shell: true });
  if ((r.status ?? 1) !== 0) throw new Error(`Falló ${scriptRel}`);
}

async function getConn() {
  const user = process.env.ORACLE_USER;
  const password = process.env.ORACLE_PASSWORD;
  const connectString = process.env.ORACLE_CONNECT_STRING;
  if (!user || !password || !connectString) throw new Error('Faltan ORACLE_USER/ORACLE_PASSWORD/ORACLE_CONNECT_STRING');
  oracledb.outFormat = oracledb.OUT_FORMAT_OBJECT;
  return oracledb.getConnection({ user, password, connectString });
}

async function sql(conn, statement, binds = {}) {
  const r = await conn.execute(statement, binds);
  return r.rows || [];
}

async function main() {
  console.log('\n=== verify-hu-all: precondiciones (seed) ===\n');
  // Asegura usuario demo/admin y datos DEMO-* antes de validar HUs
  runNode('scripts/run-seed-demo.mjs');

  console.log('\n=== verify-hu-all: fase 1 (API) ===\n');
  runNode('scripts/verify-hu-api.mjs');

  console.log('\n=== verify-hu-all: fase 2 (casos avanzados) ===\n');

  // Descubrir IDs demo por API
  let r = await j('GET', '/api/maquina');
  assert(r.ok, 'GET /api/maquina');
  const maqCob = r.data.find((m) => String(m.MAQ_CODIGO || '').includes('DEMO-COB'));
  const maqEnt = r.data.find((m) => String(m.MAQ_CODIGO || '').includes('DEMO-ENT'));
  const maqSal = r.data.find((m) => String(m.MAQ_CODIGO || '').includes('DEMO-SAL'));
  assert(maqCob && maqEnt && maqSal, 'Máquinas demo');

  r = await j('GET', '/api/tipo-vehiculo');
  assert(r.ok && r.data?.length, 'GET /api/tipo-vehiculo');
  const tve = r.data[0];

  r = await j('GET', '/api/tipo-cobro');
  const tcoEfectivo = r.data.find((x) => String(x.TCO_TIPO || '').toLowerCase().includes('efect'));
  assert(tcoEfectivo?.TCO_ID, 'TCO efectivo');

  r = await j('GET', '/api/tarifa');
  assert(r.ok && r.data?.length, 'GET /api/tarifa');
  const tarifa = r.data[0];

  // 2.1 Cobro con billetes + vuelto (requiere montoTotal > 0 rápidamente)
  const conn = await getConn();
  let originalGrace = null;
  try {
    const rows = await sql(conn, `SELECT TAR_TIEMPO_GRACIA FROM PAR_TARIFA WHERE TAR_ID = :id`, { id: tarifa.TAR_ID });
    originalGrace = rows[0]?.TAR_TIEMPO_GRACIA ?? null;
    await conn.execute(
      `UPDATE PAR_TARIFA SET TAR_TIEMPO_GRACIA = 0 WHERE TAR_ID = :id`,
      { id: tarifa.TAR_ID },
    );
    await conn.commit();

    const placa = `B${String(Date.now()).slice(-6)}`.slice(0, 7);
    r = await j('POST', '/api/ticket/entry', {
      VEH_PLACA: placa,
      VEH_MODELO: 'Cash',
      VEH_COLOR: 'Azul',
      TVE_ID: tve.TVE_ID,
      MAQ_ID: maqEnt.MAQ_ID,
    });
    assert(r.ok && r.status === 201, 'Entrada ticket (cash)');
    const ticCodigo = r.data.TIC_CODIGO;

    await new Promise((res) => setTimeout(res, 1500));
    r = await j('POST', '/api/ticket/quote', { TIC_CODIGO: ticCodigo });
    assert(r.ok, 'Quote cash');
    const monto = Number(r.data?.montoTotal ?? 0);
    assert(monto > 0, 'Monto total > 0 (gracia=0)');

    const recibido = monto + 10; // fuerza vuelto
    const billetes = { 20: 1 }; // esperado: si monto=10, recibido=20, vuelto=10
    r = await j('POST', '/api/ticket/checkout', {
      TIC_CODIGO: ticCodigo,
      TCO_ID: tcoEfectivo.TCO_ID,
      USE_CF: true,
      COB_MONTO_RECIBIDO: recibido,
      BILLETES_INGRESO: billetes,
      MAQ_ID: maqCob.MAQ_ID,
    });
    assert(r.ok && r.status === 201, 'Checkout con billetes + vuelto');

    // Importante: si TAR_TIEMPO_GRACIA=0, la validación de salida puede bloquearse por cualquier delta > 0.
    // Restauramos el tiempo de gracia antes de validar salida.
    if (originalGrace != null) {
      await conn.execute(
        `UPDATE PAR_TARIFA SET TAR_TIEMPO_GRACIA = :g WHERE TAR_ID = :id`,
        { g: originalGrace, id: tarifa.TAR_ID },
      );
      await conn.commit();
    }

    r = await j('POST', '/api/ticket/exit-validate', { TIC_CODIGO: ticCodigo, MAQ_ID: maqSal.MAQ_ID });
    assert(r.ok && r.status === 201, 'Salida cash');
    console.log('OK efectivo: billetes + vuelto');
  } finally {
    if (originalGrace != null) {
      try {
        await conn.execute(
          `UPDATE PAR_TARIFA SET TAR_TIEMPO_GRACIA = :g WHERE TAR_ID = :id`,
          { g: originalGrace, id: tarifa.TAR_ID },
        );
        await conn.commit();
      } catch {
        // ignore
      }
    }
    await conn.close();
  }

  // 2.2 Vuelto insuficiente: forzar inventario 0 en DEMO-COB y comprobar que genera alerta
  const conn2 = await getConn();
  try {
    const maqId = maqCob.MAQ_ID;
    const before = await sql(conn2, `SELECT COUNT(*) AS C FROM PAR_ALERTA`, {});

    await conn2.execute(
      `UPDATE PAR_DETALLE_SALDO SET DSA_CANTIDAD = 0, DSA_SUBTOTAL = 0 WHERE MAQ_ID = :maqId`,
      { maqId },
    );
    await conn2.commit();

    const placa = `I${String(Date.now()).slice(-6)}`.slice(0, 7);
    let rr = await j('POST', '/api/ticket/entry', {
      VEH_PLACA: placa,
      VEH_MODELO: 'Insuf',
      VEH_COLOR: 'Rojo',
      TVE_ID: tve.TVE_ID,
      MAQ_ID: maqEnt.MAQ_ID,
    });
    assert(rr.ok && rr.status === 201, 'Entrada ticket (insuf)');
    const cod = rr.data.TIC_CODIGO;

    // No importa monto; recibimos alto y pedimos vuelto, debería fallar por inventario 0
    rr = await j('POST', '/api/ticket/checkout', {
      TIC_CODIGO: cod,
      TCO_ID: tcoEfectivo.TCO_ID,
      USE_CF: true,
      COB_MONTO_RECIBIDO: 50,
      BILLETES_INGRESO: { 50: 1 },
      MAQ_ID: maqCob.MAQ_ID,
    });
    assert(!rr.ok && rr.status === 400, 'Checkout debe fallar por vuelto insuficiente');

    const after = await sql(conn2, `SELECT COUNT(*) AS C FROM PAR_ALERTA`, {});
    const b = Number(before[0]?.C || 0);
    const a = Number(after[0]?.C || 0);
    assert(a >= b + 1, 'Debe generar alerta por saldo insuficiente');
    console.log('OK vuelto insuficiente: bloqueo + alerta');
  } finally {
    // restaurar seed demo de saldos para no romper otras pruebas
    try {
      // Cantidades "seguras" similares al seed_demo_hu.sql
      await conn2.execute(
        `UPDATE PAR_DETALLE_SALDO SET DSA_CANTIDAD = CASE
            WHEN (SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = PAR_DETALLE_SALDO.SDI_ID) = 5 THEN 80
            WHEN (SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = PAR_DETALLE_SALDO.SDI_ID) = 10 THEN 60
            WHEN (SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = PAR_DETALLE_SALDO.SDI_ID) = 20 THEN 40
            WHEN (SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = PAR_DETALLE_SALDO.SDI_ID) = 50 THEN 20
            ELSE DSA_CANTIDAD END,
            DSA_SUBTOTAL = DSA_CANTIDAD * (SELECT SDI_VALOR FROM PAR_SALDO_DISPONIBLE WHERE SDI_ID = PAR_DETALLE_SALDO.SDI_ID)
        WHERE MAQ_ID = :maqId`,
        { maqId: maqCob.MAQ_ID },
      );
      await conn2.commit();
    } catch {
      // ignore
    }
    await conn2.close();
  }

  // 2.3 Tiempo de gracia superado: backdate pago y validar que bloquee salida y cree alerta
  const conn3 = await getConn();
  try {
    // Crear ticket pagado normal
    const placa = `G${String(Date.now()).slice(-6)}`.slice(0, 7);
    r = await j('POST', '/api/ticket/entry', {
      VEH_PLACA: placa,
      VEH_MODELO: 'Grace',
      VEH_COLOR: 'Negro',
      TVE_ID: tve.TVE_ID,
      MAQ_ID: maqEnt.MAQ_ID,
    });
    assert(r.ok && r.status === 201, 'Entrada ticket (grace)');
    const cod = r.data.TIC_CODIGO;

    r = await j('POST', '/api/ticket/checkout', {
      TIC_CODIGO: cod,
      TCO_ID: tcoEfectivo.TCO_ID,
      USE_CF: true,
      COB_MONTO_RECIBIDO: 10,
      MAQ_ID: maqCob.MAQ_ID,
    });
    assert(r.ok && r.status === 201, 'Checkout (grace)');

    // Forzar COB_FECHA_HORA antiguo (> gracia). Usar 60 min atrás para garantizar.
    const ticRow = await sql(conn3, `SELECT TIC_ID FROM PAR_TICKET WHERE TIC_CODIGO = :c`, { c: cod });
    const ticId = ticRow[0]?.TIC_ID;
    assert(ticId, 'TIC_ID grace');
    await conn3.execute(
      `UPDATE PAR_COBRO SET COB_FECHA_HORA = SYSDATE - (60/1440) WHERE TIC_ID = :ticId`,
      { ticId },
    );
    await conn3.commit();

    r = await j('POST', '/api/ticket/exit-validate', { TIC_CODIGO: cod, MAQ_ID: maqSal.MAQ_ID });
    assert(!r.ok && r.status === 403, 'Salida debe bloquearse por gracia superada');
    console.log('OK gracia superada: bloqueo + alerta');
  } finally {
    await conn3.close();
  }

  // 2.4 Pago mensual (API) + jobs diarios (forzados)
  r = await j('GET', '/api/membresia');
  assert(r.ok && r.data?.length, 'GET membresia');
  const mem = r.data[0];

  r = await j('GET', '/api/tipo-pago');
  assert(r.ok && r.data?.length, 'GET tipo-pago');
  const tpa = r.data.find((x) => String(x.TPA_TIPO || '').toLowerCase().includes('efect')) || r.data[0];
  assert(tpa?.TPA_ID, 'TPA_ID');

  // Registrar pago mensual
  r = await j('POST', `/api/membresia/${mem.MEM_ID}/register-payment`, {
    TPA_ID: tpa.TPA_ID,
    PAG_MONTO_RECIBIDO: Number(mem.TME_PRECIO || 500),
    REACTIVATE_IF_SUSPENDED: true,
  });
  assert(r.ok && r.status === 201 && r.data?.PAG_ID, 'Register payment');
  console.log('OK pago mensual registrado');

  // Ajustar vencimiento para disparar recordatorio hoy (3 días antes) y luego ejecutar jobs
  const conn4 = await getConn();
  try {
    await conn4.execute(
      `UPDATE PAR_MEMBRESIA SET MEM_FECHA_VENCIMIENTO = TRUNC(SYSDATE) + 3 WHERE MEM_ID = :id`,
      { id: mem.MEM_ID },
    );
    await conn4.commit();
  } finally {
    await conn4.close();
  }

  runNode('scripts/run-membership-jobs-now.mjs');

  console.log('Verificando notificaciones generadas...');
  const notif = await j('GET', '/api/notificacion');
  assert(notif.ok && Array.isArray(notif.data), 'GET notificacion');
  assert(notif.data.length > 0, 'Debe existir al menos una notificación tras jobs');
  console.log('OK jobs: notificaciones generadas');

  console.log('\nOK: verify-hu-all completado.\n');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('FALLO:', e?.message || e);
    process.exit(1);
  });

