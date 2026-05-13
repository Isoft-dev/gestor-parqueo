import PDFDocument from 'pdfkit/js/pdfkit.js';
import { executeSql } from '../db/oracle.js';

function parseYmd(s) {
  const m = String(s ?? '').trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function daysInclusive(desde, hasta) {
  const a = new Date(desde.getFullYear(), desde.getMonth(), desde.getDate());
  const b = new Date(hasta.getFullYear(), hasta.getMonth(), hasta.getDate());
  return Math.floor((b - a) / (24 * 60 * 60 * 1000)) + 1;
}

function validateRango(desdeStr, hastaStr) {
  const desde = parseYmd(desdeStr);
  const hasta = parseYmd(hastaStr);
  if (!desde) return { error: 'La fecha de inicio no es válida (use AAAA-MM-DD).' };
  if (!hasta) return { error: 'La fecha de fin no es válida (use AAAA-MM-DD).' };
  if (desde > hasta) return { error: 'La fecha de inicio no puede ser posterior a la fecha de fin.' };
  const span = daysInclusive(desde, hasta);
  if (span > 731) return { error: 'El rango máximo permitido es de 731 días (2 años).' };
  return { desde, hasta };
}

function fmtPeriodo(desde, hasta) {
  return {
    desde: `${desde.getFullYear()}-${String(desde.getMonth() + 1).padStart(2, '0')}-${String(desde.getDate()).padStart(2, '0')}`,
    hasta: `${hasta.getFullYear()}-${String(hasta.getMonth() + 1).padStart(2, '0')}-${String(hasta.getDate()).padStart(2, '0')}`,
  };
}

function fmtDuracionMin(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n < 0) return '—';
  const total = Math.round(n);
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${h} h ${m} min`;
}

function weekdayEs(dateLike) {
  const d = dateLike ? new Date(dateLike) : null;
  if (!d || Number.isNaN(d.getTime())) return 'Sin fecha';
  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  return days[d.getDay()];
}

export async function getVehiculosFrecuentes(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const periodo = fmtPeriodo(v.desde, v.hasta);

  const rows = await executeSql(
    `SELECT t.VEH_ID,
            v.VEH_PLACA,
            v.VEH_MODELO,
            v.VEH_COLOR,
            v.CLI_ID,
            COUNT(*) AS TOTAL_VISITAS
       FROM PAR_TICKET t
       JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
      WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      GROUP BY t.VEH_ID, v.VEH_PLACA, v.VEH_MODELO, v.VEH_COLOR, v.CLI_ID
      ORDER BY COUNT(*) DESC, v.VEH_PLACA`,
    periodo
  );

  const detalle = rows.map((r) => ({
    vehiculoId: r.VEH_ID ?? r.veh_id,
    placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
    modelo: r.VEH_MODELO ?? r.veh_modelo ?? '—',
    color: r.VEH_COLOR ?? r.veh_color ?? '—',
    visitas: Number(r.TOTAL_VISITAS ?? r.total_visitas ?? 0),
    tipoCliente: (r.CLI_ID ?? r.cli_id) != null ? 'Mensual registrado' : 'Esporádico',
  }));

  return {
    periodo,
    totalVehiculos: detalle.length,
    top10: detalle.slice(0, 10),
    detalle,
  };
}

export async function getEntradasSalidas(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const periodo = fmtPeriodo(v.desde, v.hasta);

  const tickets = await executeSql(
    `SELECT t.TIC_ID,
            t.TIC_CODIGO,
            v.VEH_PLACA,
            t.TIC_FECHA_HORA_ENTRADA,
            t.TIC_FECHA_HORA_SALIDA,
            e.ETI_ESTADO
       FROM PAR_TICKET t
       JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
       LEFT JOIN PAR_ESTADO_TICKET e ON e.ETI_ID = t.ETI_ID
      WHERE (
              TRUNC(t.TIC_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
           OR TRUNC(t.TIC_FECHA_HORA_SALIDA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
            )
      ORDER BY t.TIC_FECHA_HORA_ENTRADA DESC`,
    periodo
  );

  const movimientosMem = await executeSql(
    `SELECT r.RMM_ID,
            v.VEH_PLACA,
            r.RMM_FECHA_HORA_ENTRADA,
            r.RMM_FECHA_HORA_SALIDA
       FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA r
       JOIN PAR_MEMBRESIA m ON m.MEM_ID = r.MEM_ID
       JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
      WHERE (
              TRUNC(r.RMM_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
           OR TRUNC(r.RMM_FECHA_HORA_SALIDA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
            )
      ORDER BY r.RMM_FECHA_HORA_ENTRADA DESC`,
    periodo
  );

  const detalleEsp = tickets.map((r) => {
    const entrada = r.TIC_FECHA_HORA_ENTRADA ?? r.tic_fecha_hora_entrada;
    const salida = r.TIC_FECHA_HORA_SALIDA ?? r.tic_fecha_hora_salida;
    const mins = entrada && salida
      ? Math.max(0, (new Date(salida).getTime() - new Date(entrada).getTime()) / (1000 * 60))
      : null;
    return {
      tipoCliente: 'Esporádico',
      referencia: r.TIC_CODIGO ?? r.tic_codigo ?? `T-${r.TIC_ID ?? r.tic_id}`,
      placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
      horaEntrada: entrada,
      horaSalida: salida,
      tiempoEstadia: fmtDuracionMin(mins),
      estadoTicket: r.ETI_ESTADO ?? r.eti_estado ?? '—',
    };
  });

  const detalleMem = movimientosMem.map((r) => {
    const entrada = r.RMM_FECHA_HORA_ENTRADA ?? r.rmm_fecha_hora_entrada;
    const salida = r.RMM_FECHA_HORA_SALIDA ?? r.rmm_fecha_hora_salida;
    const mins = entrada && salida
      ? Math.max(0, (new Date(salida).getTime() - new Date(entrada).getTime()) / (1000 * 60))
      : null;
    return {
      tipoCliente: 'Mensual',
      referencia: `MM-${r.RMM_ID ?? r.rmm_id}`,
      placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
      horaEntrada: entrada,
      horaSalida: salida,
      tiempoEstadia: fmtDuracionMin(mins),
      estadoTicket: 'Membresía',
    };
  });

  const detalle = [...detalleEsp, ...detalleMem].sort((a, b) => {
    const ta = new Date(a.horaEntrada || 0).getTime();
    const tb = new Date(b.horaEntrada || 0).getTime();
    return tb - ta;
  });

  const inRange = (d) => {
    const x = d ? new Date(d) : null;
    if (!x || Number.isNaN(x.getTime())) return false;
    const ymd = `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
    return ymd >= periodo.desde && ymd <= periodo.hasta;
  };
  const totalEntradas = detalle.reduce((s, r) => s + (inRange(r.horaEntrada) ? 1 : 0), 0);
  const totalSalidas = detalle.reduce((s, r) => s + (inRange(r.horaSalida) ? 1 : 0), 0);

  return {
    periodo,
    totalRegistros: detalle.length,
    totalEntradas,
    totalSalidas,
    detalle,
  };
}

export async function getTiempoPromedioEstadia(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) {
    const err = new Error(v.error);
    err.code = 'VALIDATION';
    throw err;
  }
  const periodo = fmtPeriodo(v.desde, v.hasta);

  const rows = await executeSql(
    `SELECT t.TIC_CODIGO,
            v.VEH_PLACA,
            t.TIC_FECHA_HORA_ENTRADA,
            t.TIC_FECHA_HORA_SALIDA,
            c.COB_FECHA_HORA
       FROM PAR_TICKET t
       JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
       JOIN PAR_ESTADO_TICKET e ON e.ETI_ID = t.ETI_ID
       LEFT JOIN PAR_COBRO c ON c.TIC_ID = t.TIC_ID
      WHERE LOWER(e.ETI_ESTADO) LIKE '%pagad%'
        AND t.TIC_FECHA_HORA_ENTRADA IS NOT NULL
        AND (
              t.TIC_FECHA_HORA_SALIDA IS NOT NULL
              OR c.COB_FECHA_HORA IS NOT NULL
            )
        AND NVL(t.TIC_FECHA_HORA_SALIDA, c.COB_FECHA_HORA) >= t.TIC_FECHA_HORA_ENTRADA
        AND TRUNC(NVL(t.TIC_FECHA_HORA_SALIDA, c.COB_FECHA_HORA)) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
      ORDER BY NVL(t.TIC_FECHA_HORA_SALIDA, c.COB_FECHA_HORA) DESC`,
    periodo
  );

  const detalle = rows
    .map((r) => {
      const entrada = r.TIC_FECHA_HORA_ENTRADA ?? r.tic_fecha_hora_entrada;
      const salida =
        r.TIC_FECHA_HORA_SALIDA ??
        r.tic_fecha_hora_salida ??
        r.COB_FECHA_HORA ??
        r.cob_fecha_hora;
      const mins = Math.max(0, (new Date(salida).getTime() - new Date(entrada).getTime()) / (1000 * 60));
      return {
        codigo: r.TIC_CODIGO ?? r.tic_codigo ?? '—',
        placa: r.VEH_PLACA ?? r.veh_placa ?? '—',
        fechaSalida: salida,
        minutos: mins,
      };
    })
    .filter((r) => Number.isFinite(r.minutos));

  if (!detalle.length) {
    return {
      periodo,
      totalRegistros: 0,
      promedioGeneral: null,
      promedioPorDiaSemana: [],
      maximo: null,
      minimo: null,
    };
  }

  const totalMin = detalle.reduce((s, r) => s + r.minutos, 0);
  const promedioGeneralMin = totalMin / detalle.length;

  const byDay = new Map();
  for (const row of detalle) {
    const key = weekdayEs(row.fechaSalida);
    const prev = byDay.get(key) || { suma: 0, cantidad: 0 };
    byDay.set(key, { suma: prev.suma + row.minutos, cantidad: prev.cantidad + 1 });
  }
  const order = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const promedioPorDiaSemana = [...byDay.entries()]
    .map(([diaSemana, v2]) => ({
      diaSemana,
      promedioMinutos: Number((v2.suma / v2.cantidad).toFixed(2)),
      promedioEtiqueta: fmtDuracionMin(v2.suma / v2.cantidad),
      cantidadRegistros: v2.cantidad,
    }))
    .sort((a, b) => order.indexOf(a.diaSemana) - order.indexOf(b.diaSemana));

  const maxRow = detalle.reduce((m, r) => (r.minutos > m.minutos ? r : m), detalle[0]);
  const minRow = detalle.reduce((m, r) => (r.minutos < m.minutos ? r : m), detalle[0]);

  return {
    periodo,
    totalRegistros: detalle.length,
    promedioGeneral: {
      minutos: Number(promedioGeneralMin.toFixed(2)),
      etiqueta: fmtDuracionMin(promedioGeneralMin),
    },
    promedioPorDiaSemana,
    maximo: {
      placa: maxRow.placa,
      codigo: maxRow.codigo,
      fecha: maxRow.fechaSalida,
      minutos: Number(maxRow.minutos.toFixed(2)),
      etiqueta: fmtDuracionMin(maxRow.minutos),
    },
    minimo: {
      placa: minRow.placa,
      codigo: minRow.codigo,
      fecha: minRow.fechaSalida,
      minutos: Number(minRow.minutos.toFixed(2)),
      etiqueta: fmtDuracionMin(minRow.minutos),
    },
  };
}

function buildPdf(title, periodo, sections) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const drawSectionTitle = (txt) => {
      doc.moveDown(0.45);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#111827').text(txt);
      const y = doc.y + 2;
      doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).strokeColor('#cbd5e1').lineWidth(1).stroke();
      doc.moveDown(0.35);
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
    };

    const writeLine = (ln) => {
      if (doc.y > doc.page.height - 72) doc.addPage();
      doc.text(ln, { width: doc.page.width - doc.page.margins.left - doc.page.margins.right });
    };

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827').text(title, { align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#334155').text(`Período: ${periodo.desde} al ${periodo.hasta}`, { align: 'center' });
    doc.text(`Generado: ${new Date().toLocaleString('es-GT')}`, { align: 'center' });

    (sections || []).forEach((s) => {
      drawSectionTitle(s.title);
      (s.lines || []).forEach(writeLine);
    });

    doc.end();
  });
}

export async function buildVehiculosFrecuentesPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const tableW = right - left;
    const rowH = 18;
    const headerH = 21;
    const colRatio = [0.09, 0.2, 0.23, 0.18, 0.2, 0.1];
    const colW = colRatio.map((r) => Math.floor(tableW * r));
    colW[colW.length - 1] = tableW - colW.slice(0, -1).reduce((s, n) => s + n, 0);
    const headers = ['#', 'Placa', 'Modelo', 'Color', 'Tipo de cliente', 'Visitas'];

    const oneLine = (txt, max) => {
      const s = String(txt ?? '—').replace(/\s+/g, ' ').trim();
      if (s.length <= max) return s;
      return `${s.slice(0, Math.max(1, max - 1))}…`;
    };

    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827')
        .text('Reporte de vehículos con mayor frecuencia de visitas', left, 24, { width: tableW, align: 'center' });
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#334155')
        .text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, left, doc.y, { width: tableW, align: 'center' });
      doc.text(
        `Vehículos en el rango: ${data.totalVehiculos}   ·   Top destacados: ${Math.min(10, data.top10.length)}`,
        left,
        doc.y + 2,
        { width: tableW, align: 'center' }
      );
      doc.y += 12;
      doc.font('Helvetica').fontSize(8.2).fillColor('#0f172a');
    };

    const drawColumnHeaderRow = () => {
      const y = doc.y;
      doc.rect(left, y, tableW, headerH).fill('#e2e8f0');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
      let x = left;
      headers.forEach((h, i) => {
        doc.text(h, x + 4, y + 6, { width: colW[i] - 8, align: 'left', lineBreak: false });
        x += colW[i];
      });
      doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, tableW, headerH).stroke();
      doc.y = y + headerH;
      doc.font('Helvetica').fontSize(8.2).fillColor('#0f172a');
    };

    const ensureSpace = () => {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 28 });
        drawHeader();
      }
    };

    drawHeader();

    if (!data.detalle.length) {
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(10).fillColor('#475569').text('Sin datos disponibles para el rango seleccionado.', { align: 'center' });
      doc.end();
      return;
    }

    doc.moveDown(0.4);
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
      .text('Top 10 vehículos más frecuentes:', left, doc.y, { width: tableW, align: 'left' });
    doc.moveDown(0.15);
    drawColumnHeaderRow();
    const top10 = Array.isArray(data.top10) ? data.top10 : [];
    top10.forEach((r, idx) => {
      ensureSpace();
      const y = doc.y;
      if (idx % 2 === 0) doc.rect(left, y, tableW, rowH).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, tableW, rowH).stroke();
      const values = [
        String(idx + 1),
        oneLine(r.placa, 16),
        oneLine(r.modelo, 26),
        oneLine(r.color, 18),
        oneLine(r.tipoCliente, 22),
        String(r.visitas),
      ];
      let x = left;
      values.forEach((v, i) => {
        doc.fillColor('#0f172a').font('Helvetica').fontSize(8.2).text(v, x + 4, y + 5, { width: colW[i] - 8, align: 'left', lineBreak: false });
        x += colW[i];
      });
      doc.y = y + rowH;
    });

    doc.moveDown(0.8);
    if (doc.y + headerH > doc.page.height - doc.page.margins.bottom) {
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 28 });
      drawHeader();
    }
    // Espaciado extra fijo antes del segundo bloque para que el título respire.
    doc.y += 10;
    doc.font('Helvetica-Bold').fontSize(10).fillColor('#0f172a')
      .text('Listado completo:', left, doc.y, { width: tableW, align: 'left' });
    doc.moveDown(0.15);
    drawColumnHeaderRow();

    data.detalle.forEach((r, idx) => {
      ensureSpace();
      const y = doc.y;
      if (idx % 2 === 0) doc.rect(left, y, tableW, rowH).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, tableW, rowH).stroke();

      const values = [
        String(idx + 1),
        oneLine(r.placa, 16),
        oneLine(r.modelo, 26),
        oneLine(r.color, 18),
        oneLine(r.tipoCliente, 22),
        String(r.visitas),
      ];
      let x = left;
      values.forEach((v, i) => {
        doc.fillColor('#0f172a').font('Helvetica').fontSize(8.2).text(v, x + 4, y + 5, { width: colW[i] - 8, align: 'left', lineBreak: false });
        x += colW[i];
      });
      doc.y = y + rowH;
    });

    doc.end();
  });
}

export async function buildEntradasSalidasPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 28, size: 'A4', layout: 'landscape' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const tableW = right - left;
    const rowH = 18;
    const headerH = 21;
    // Sin columna "Estado de ticket": damos más ancho a fechas para legibilidad.
    // Priorizamos "Identificador" para evitar recortes con puntos suspensivos.
    const colRatio = [0.11, 0.17, 0.09, 0.24, 0.24, 0.15];
    const colW = colRatio.map((r) => Math.floor(tableW * r));
    colW[colW.length - 1] = tableW - colW.slice(0, -1).reduce((s, n) => s + n, 0);
    const headers = [
      'Tipo de cliente',
      'Identificador',
      'Placa',
      'Fecha y hora de entrada',
      'Fecha y hora de salida',
      'Tiempo de estadía',
    ];

    const fmt = (v) => {
      const d = v ? new Date(v) : null;
      return d && !Number.isNaN(d.getTime()) ? d.toLocaleString('es-GT') : '—';
    };
    const oneLine = (txt, max) => {
      const s = String(txt ?? '—').replace(/\s+/g, ' ').trim();
      if (s.length <= max) return s;
      return `${s.slice(0, Math.max(1, max - 1))}…`;
    };

    const drawHeader = () => {
      doc.font('Helvetica-Bold').fontSize(15).fillColor('#111827')
        .text('Reporte de entradas y salidas por rango de fechas', left, 24, { width: tableW, align: 'center' });
      doc.moveDown(0.2);
      doc.font('Helvetica').fontSize(9).fillColor('#334155')
        .text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, left, doc.y, { width: tableW, align: 'center' });
      doc.text(
        `Entradas: ${data.totalEntradas}   ·   Salidas: ${data.totalSalidas}   ·   Registros: ${data.totalRegistros}`,
        left,
        doc.y + 2,
        { width: tableW, align: 'center' }
      );
      doc.y += 12;

      const y = doc.y;
      doc.rect(left, y, tableW, headerH).fill('#e2e8f0');
      doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8.5);
      let x = left;
      headers.forEach((h, i) => {
        doc.text(h, x + 4, y + 6, { width: colW[i] - 8, align: 'left', lineBreak: false });
        x += colW[i];
      });
      doc.strokeColor('#94a3b8').lineWidth(0.8).rect(left, y, tableW, headerH).stroke();
      doc.y = y + headerH;
      doc.font('Helvetica').fontSize(8.2).fillColor('#0f172a');
    };

    const ensureSpace = () => {
      if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 28 });
        drawHeader();
      }
    };

    drawHeader();

    if (!data.detalle.length) {
      doc.moveDown(0.8);
      doc.font('Helvetica').fontSize(10).fillColor('#475569').text('Sin datos disponibles para el rango seleccionado.', { align: 'center' });
      doc.end();
      return;
    }

    doc.font('Helvetica').fontSize(8.2).fillColor('#0f172a');
    data.detalle.forEach((r, idx) => {
      ensureSpace();
      const y = doc.y;
      if (idx % 2 === 0) doc.rect(left, y, tableW, rowH).fill('#f8fafc');
      doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, tableW, rowH).stroke();

      const values = [
        oneLine(r.tipoCliente, 16),
        oneLine(r.referencia, 26),
        oneLine(r.placa, 12),
        oneLine(fmt(r.horaEntrada), 26),
        oneLine(fmt(r.horaSalida), 26),
        oneLine(r.tiempoEstadia, 14),
      ];
      let x = left;
      values.forEach((v, i) => {
        doc.fillColor('#0f172a').font('Helvetica').fontSize(8.2).text(v, x + 4, y + 5, { width: colW[i] - 8, align: 'left', lineBreak: false });
        x += colW[i];
      });
      doc.y = y + rowH;
    });

    doc.end();
  });
}

export async function buildTiempoPromedioPdfBuffer(data) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;
    const rows = Array.isArray(data.promedioPorDiaSemana) ? data.promedioPorDiaSemana : [];
    const total = rows.reduce((s, r) => s + Number(r.cantidadRegistros || 0), 0);
    const colors = ['#2563eb', '#0ea5e9', '#14b8a6', '#22c55e', '#84cc16', '#eab308', '#f97316'];

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
      .text('Reporte de tiempo promedio de estadía', left, 28, { width, align: 'center' });
    doc.moveDown(0.25);
    doc.font('Helvetica').fontSize(10).fillColor('#334155')
      .text(`Período: ${data.periodo.desde} al ${data.periodo.hasta}`, left, doc.y, { width, align: 'center' });
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Resumen');
    doc.font('Helvetica').fontSize(9);
    doc.text(`Total de registros válidos: ${data.totalRegistros}`);
    doc.text(`Promedio general: ${data.promedioGeneral?.etiqueta || '—'}`);
    doc.text(`Máximo: ${data.maximo ? `${data.maximo.placa} · ${data.maximo.etiqueta} · ${new Date(data.maximo.fecha).toLocaleString('es-GT')}` : '—'}`);
    doc.text(`Mínimo: ${data.minimo ? `${data.minimo.placa} · ${data.minimo.etiqueta} · ${new Date(data.minimo.fecha).toLocaleString('es-GT')}` : '—'}`);
    doc.moveDown(0.6);

    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text('Promedio por día de la semana');
    doc.moveDown(0.25);
    if (!rows.length) {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Sin datos disponibles.');
    } else {
      doc.font('Helvetica').fontSize(9).fillColor('#0f172a');
      rows.forEach((r) => {
        doc.text(`${r.diaSemana}: ${r.promedioEtiqueta} (${r.cantidadRegistros} registro(s))`);
      });
    }

    doc.moveDown(0.7);
    doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a')
      .text('Distribución por día de la semana (gráfica circular)');
    const cx = left + 120;
    const cy = doc.y + 80;
    const radius = 62;

    if (total > 0) {
      let start = -Math.PI / 2;
      rows.forEach((row, idx) => {
        const count = Number(row.cantidadRegistros || 0);
        if (count <= 0) return;
        const frac = count / total;
        const angle = frac * 2 * Math.PI;
        const end = start + angle;
        const x0 = cx + radius * Math.cos(start);
        const y0 = cy + radius * Math.sin(start);
        const x1 = cx + radius * Math.cos(end);
        const y1 = cy + radius * Math.sin(end);
        const largeArc = angle > Math.PI ? 1 : 0;
        const d = `M ${cx} ${cy} L ${x0} ${y0} A ${radius} ${radius} 0 ${largeArc} 1 ${x1} ${y1} Z`;
        doc.path(d).fill(colors[idx % colors.length]).stroke('#ffffff');
        start = end;
      });

      let legY = cy - 56;
      rows.forEach((row, idx) => {
        const count = Number(row.cantidadRegistros || 0);
        if (count <= 0) return;
        const pct = ((count / total) * 100).toFixed(0);
        const lx = left + 240;
        doc.rect(lx, legY, 9, 9).fill(colors[idx % colors.length]);
        doc.fillColor('#0f172a').font('Helvetica').fontSize(9)
          .text(`${row.diaSemana}: ${count} (${pct}%)`, lx + 14, legY - 1, { width: width - 260 });
        legY += 18;
      });
    } else {
      doc.moveDown(0.4);
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Sin datos para graficar.');
    }

    doc.end();
  });
}
