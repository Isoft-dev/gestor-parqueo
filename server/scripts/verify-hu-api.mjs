/**
 * Verificación exhaustiva API + datos demo (HU).
 * Uso (desde carpeta server): node scripts/verify-hu-api.mjs
 * Requiere API en BASE_URL (default http://127.0.0.1:3001) y DB con seed_demo_hu.sql.
 */
const BASE = process.env.BASE_URL || 'http://127.0.0.1:3001';

async function j(method, path, body) {
  const r = await fetch(`${BASE}${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let data;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { ok: r.ok, status: r.status, data };
}

async function bin(method, path) {
  const r = await fetch(`${BASE}${path}`, { method });
  const ab = await r.arrayBuffer();
  const buf = Buffer.from(ab);
  return { ok: r.ok, status: r.status, buf, contentType: r.headers.get('content-type') || '' };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function isPdf(buf) {
  return buf.length >= 4 && buf.subarray(0, 4).toString('ascii') === '%PDF';
}

async function main() {
  const results = [];

  let r = await j('GET', '/api/health');
  assert(r.ok && r.data?.oracle, 'Health / Oracle');
  results.push('OK /api/health + oracle');

  r = await j('POST', '/api/usuario/login', {
    USU_CORREO: 'admin@parqueo.demo',
    USU_PASSWORD: 'Admin123!',
  });
  assert(r.ok && r.data?.USU_ID, 'Login demo');
  results.push('OK login admin@parqueo.demo');

  const catalogGets = [
    { path: '/api/rol', label: 'rol' },
    { path: '/api/estado-espacio', label: 'estado espacio' },
    { path: '/api/estado-maquina', label: 'estado máquina' },
    { path: '/api/tipo-maquina', label: 'tipo máquina' },
    { path: '/api/tipo-cobro', label: 'tipo cobro' },
    { path: '/api/tipo-alerta', label: 'tipo alerta' },
    { path: '/api/estado-alerta', label: 'estado alerta' },
    { path: '/api/tipo-pago', label: 'tipo pago' },
    { path: '/api/tipo-notificacion', label: 'tipo notificación' },
    { path: '/api/incidente', label: 'incidente' },
    { path: '/api/saldo-disponible', label: 'saldo disponible' },
    { path: '/api/estado-ticket', label: 'estado ticket' },
    { path: '/api/estado-membresia', label: 'estado membresía' },
    { path: '/api/tipo-membresia', label: 'tipo membresía' },
    { path: '/api/registro-movimiento-membresia', label: 'registro movimiento membresía', allowEmpty: true },
  ];
  for (const { path, label, allowEmpty } of catalogGets) {
    r = await j('GET', path);
    assert(r.ok && Array.isArray(r.data), `Catálogo ${label}`);
    if (!allowEmpty) assert(r.data.length > 0, `Catálogo ${label} vacío`);
  }
  results.push(`OK catálogos (${catalogGets.length} listados)`);

  r = await j('GET', '/api/maquina');
  assert(r.ok && Array.isArray(r.data) && r.data.length >= 3, 'Máquinas demo');
  const maqCob = r.data.find((m) => String(m.MAQ_CODIGO || '').includes('DEMO-COB'));
  const maqEnt = r.data.find((m) => String(m.MAQ_CODIGO || '').includes('DEMO-ENT'));
  const maqSal = r.data.find((m) => String(m.MAQ_CODIGO || '').includes('DEMO-SAL'));
  assert(maqCob && maqEnt && maqSal, 'Máquinas DEMO-ENT / DEMO-SAL / DEMO-COB');
  results.push(`OK ${r.data.length} máquinas (COB=${maqCob.MAQ_ID})`);

  r = await j('GET', `/api/detalle-saldo/maquina/${maqCob.MAQ_ID}`);
  assert(r.ok && Array.isArray(r.data) && r.data.length > 0, 'Detalle saldo máquina cobro');
  results.push('OK detalle saldo DEMO-COB');

  r = await j('GET', `/api/registro-mantenimiento/maquina/${maqEnt.MAQ_ID}`);
  assert(r.ok && Array.isArray(r.data), 'Registro mantenimiento por máquina');
  results.push('OK registro mantenimiento máquina');

  r = await j('GET', `/api/recargo-maquina/maquina/${maqCob.MAQ_ID}`);
  assert(r.ok && Array.isArray(r.data), 'Recargo máquina');
  results.push('OK recargo máquina');

  r = await j('GET', '/api/espacio/resumen-publico');
  assert(r.ok && Number(r.data?.disponibles) > 0, 'Espacios disponibles > 0');
  assert(r.data?.parqueoLleno === false, 'Parqueo no lleno');
  results.push(`OK resumen público: ${r.data.disponibles} disponibles`);

  r = await j('GET', '/api/espacio');
  assert(r.ok && Array.isArray(r.data) && r.data.length > 0, 'Listado espacios');
  results.push(`OK espacios listados (${r.data.length})`);

  r = await j('POST', '/api/alerta/solicitud-asistencia', {
    MAQ_ID: maqCob.MAQ_ID,
    ALE_MOTIVO: 'Verificación QA verify-hu-api',
  });
  assert(r.ok || r.status === 201, `Asistencia ${r.status}`);
  results.push('OK solicitud asistencia');

  r = await j('GET', '/api/alerta');
  assert(r.ok && Array.isArray(r.data), 'Listado alertas');
  results.push(`OK alertas (${r.data.length})`);

  r = await j('POST', '/api/ticket/quote', { TIC_CODIGO: 'INVALIDO-999' });
  assert(!r.ok, 'Cotización ticket inexistente debe fallar');

  r = await j('GET', '/api/tipo-vehiculo');
  assert(r.ok && r.data?.length > 0, 'Tipos vehículo');
  const tve = r.data[0];
  results.push(`OK ${r.data.length} tipos vehículo`);

  r = await j('GET', '/api/tarifa');
  assert(r.ok && r.data?.length > 0, 'Tarifas');
  results.push(`OK ${r.data.length} tarifas`);

  r = await j('GET', '/api/tipo-cobro');
  const tcoEfectivo = r.data.find((x) => String(x.TCO_TIPO || '').toLowerCase().includes('efect'));
  assert(tcoEfectivo?.TCO_ID, 'Tipo cobro efectivo');
  results.push(`OK tipo cobro efectivo TCO_ID=${tcoEfectivo.TCO_ID}`);

  r = await j('GET', '/api/cliente');
  assert(r.ok && Array.isArray(r.data), 'Clientes');
  results.push(`OK clientes: ${r.data.length}`);

  r = await j('GET', '/api/membresia');
  assert(r.ok && Array.isArray(r.data) && r.data.length > 0, 'Membresías');
  const memDemo = r.data[0];
  results.push(`OK ${r.data.length} membresía(s)`);

  r = await j('GET', '/api/membresia/payment-candidates/search?q=mens');
  assert(r.ok && Array.isArray(r.data), 'Búsqueda candidatos pago mensual');
  results.push(`OK payment-candidates (${r.data.length})`);

  const tagPdf = await bin('GET', `/api/membresia/${memDemo.MEM_ID}/tag.pdf`);
  assert(tagPdf.ok && isPdf(tagPdf.buf), 'PDF tag membresía');
  results.push('OK membresía tag.pdf');

  r = await j('GET', `/api/membresia/${memDemo.MEM_ID}/history`);
  assert(
    r.ok && r.data?.membership && Array.isArray(r.data.movimientos) && Array.isArray(r.data.pagos),
    'Historial membresía',
  );
  results.push('OK historial membresía');

  const memCodigoDemo = '010426DEMOMEM01';
  r = await j('POST', '/api/membresia/validate-tag', { MEM_CODIGO: memCodigoDemo });
  assert(r.ok && r.status === 201 && r.data?.access === 'granted', 'Entrada por tag');
  results.push('OK membresía validate-tag (entrada)');

  r = await j('POST', '/api/membresia/validate-tag-exit', { MEM_CODIGO: memCodigoDemo });
  assert(r.ok && r.status === 201 && r.data?.access === 'granted', 'Salida por tag');
  results.push('OK membresía validate-tag-exit');

  const placaUnica = `T${String(Date.now()).slice(-6)}`.slice(0, 7);
  r = await j('POST', '/api/ticket/entry', {
    VEH_PLACA: placaUnica,
    VEH_MODELO: 'Test',
    VEH_COLOR: 'Negro',
    TVE_ID: tve.TVE_ID,
    MAQ_ID: maqEnt.MAQ_ID,
  });
  assert(r.ok && r.status === 201 && r.data?.TIC_ID && r.data?.TIC_CODIGO, 'Generar ticket entrada');
  const ticId = r.data.TIC_ID;
  const ticCodigo = r.data.TIC_CODIGO;
  results.push(`OK ticket entrada TIC_ID=${ticId}`);

  r = await j('GET', `/api/ticket/${ticId}`);
  assert(r.ok && r.data?.TIC_CODIGO, 'GET ticket por id');
  results.push('OK GET ticket por id');

  const pdfEnt = await bin('GET', `/api/ticket/${ticId}/entrada.pdf`);
  assert(pdfEnt.ok && isPdf(pdfEnt.buf), 'PDF entrada');
  results.push('OK ticket entrada.pdf');

  r = await j('POST', '/api/ticket/quote', { TIC_CODIGO: ticCodigo });
  assert(r.ok && r.data && typeof r.data.montoTotal === 'number', 'Cotización por código');
  const montoTotal = Number(r.data.montoTotal);
  results.push(`OK quote montoTotal=Q${montoTotal.toFixed(2)}`);

  const recibido = Math.max(montoTotal, 0);
  r = await j('POST', '/api/ticket/checkout', {
    TIC_CODIGO: ticCodigo,
    TCO_ID: tcoEfectivo.TCO_ID,
    USE_CF: true,
    COB_MONTO_RECIBIDO: recibido,
    MAQ_ID: maqCob.MAQ_ID,
  });
  assert(r.ok && r.status === 201 && r.data?.COB_ID, 'Checkout / cobro');
  results.push(`OK checkout COB_ID=${r.data.COB_ID}`);

  const pdfComp = await bin('GET', `/api/ticket/${ticId}/comprobante.pdf`);
  assert(pdfComp.ok && isPdf(pdfComp.buf), 'PDF comprobante');
  results.push('OK ticket comprobante.pdf');

  r = await j('GET', '/api/cobro');
  assert(r.ok && Array.isArray(r.data) && r.data.length > 0, 'Listado cobros');
  results.push(`OK cobros (${r.data.length})`);

  r = await j('POST', '/api/ticket/exit-validate', {
    TIC_CODIGO: ticCodigo,
    MAQ_ID: maqSal.MAQ_ID,
  });
  assert(r.ok && r.status === 201 && r.data?.access === 'granted', 'Validación salida');
  results.push('OK exit-validate (cabina salida)');

  r = await j('GET', `/api/detalle-maquina-ticket/maquina/${maqCob.MAQ_ID}`);
  assert(r.ok && Array.isArray(r.data), 'Detalle máquina-ticket');
  results.push('OK detalle-maquina-ticket');

  r = await j('GET', `/api/maquina/${maqCob.MAQ_ID}/transacciones`);
  assert(r.ok && Array.isArray(r.data), 'Transacciones máquina');
  results.push('OK transacciones máquina');

  r = await j('GET', '/api/vehiculo');
  assert(r.ok && Array.isArray(r.data), 'Vehículos');
  results.push(`OK vehículos (${r.data.length})`);

  r = await j('GET', '/api/ticket');
  assert(r.ok && Array.isArray(r.data), 'Listado tickets');
  results.push(`OK tickets list (${r.data.length})`);

  r = await j('GET', '/api/pago');
  assert(r.ok && Array.isArray(r.data), 'Pagos');
  results.push(`OK pagos (${r.data.length})`);

  r = await j('GET', '/api/notificacion');
  assert(r.ok && Array.isArray(r.data), 'Notificaciones');
  results.push(`OK notificaciones (${r.data.length})`);

  r = await j('GET', '/api/bitacora-incidente-vehiculo');
  assert(r.ok && Array.isArray(r.data), 'Bitácora incidente vehículo');
  results.push(`OK bitácora incidente (${r.data.length})`);

  const placaExtrav = `X${String(Date.now()).slice(-6)}`.slice(0, 7);
  r = await j('POST', '/api/ticket/entry', {
    VEH_PLACA: placaExtrav,
    VEH_MODELO: 'Test',
    VEH_COLOR: 'Rojo',
    TVE_ID: tve.TVE_ID,
    MAQ_ID: maqEnt.MAQ_ID,
  });
  assert(r.ok && r.status === 201, 'Ticket para flujo extraviado');
  r = await j('POST', '/api/ticket/extraviado/preparar', { VEH_PLACA: placaExtrav });
  assert(r.ok && r.data?.montoTotal != null, 'Preparar ticket extraviado + quote');
  results.push('OK extraviado/preparar');

  // Importante para pruebas repetidas: este flujo también consume un espacio esporádico.
  // Para no “llenar” el parqueo en loops, pagamos y registramos salida del ticket extraviado.
  const extravCodigo = r.data?.ticket?.TIC_CODIGO;
  assert(extravCodigo, 'TIC_CODIGO extraviado');
  const extravMonto = Number(r.data?.montoTotal ?? 0);
  const extravRecibido = Math.max(extravMonto, 0);
  r = await j('POST', '/api/ticket/checkout', {
    TIC_CODIGO: extravCodigo,
    TCO_ID: tcoEfectivo.TCO_ID,
    USE_CF: true,
    COB_MONTO_RECIBIDO: extravRecibido,
    MAQ_ID: maqCob.MAQ_ID,
  });
  assert(r.ok && r.status === 201 && r.data?.COB_ID, 'Checkout extraviado');
  r = await j('POST', '/api/ticket/exit-validate', {
    TIC_CODIGO: extravCodigo,
    MAQ_ID: maqSal.MAQ_ID,
  });
  assert(r.ok && r.status === 201 && r.data?.access === 'granted', 'Salida extraviado');
  results.push('OK extraviado checkout+salida');

  console.log('\n--- Verificación HU API (exhaustiva) ---\n');
  for (const line of results) console.log(line);
  console.log('\nTodas las comprobaciones pasaron.\n');
}

main().catch((e) => {
  console.error('FALLO:', e.message);
  process.exit(1);
});
