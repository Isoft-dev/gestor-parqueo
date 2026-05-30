import PDFDocument from 'pdfkit/js/pdfkit.js';
import { executeSql } from '../db/oracle.js';
import { vehiculoCatalogJoin, vehiculoCatalogSelect } from '../utils/vehiculoCatalogSql.js';

// ─── Constantes ──────────────────────────────────────────────────────────────

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

// ─── Helpers de fecha / rango ────────────────────────────────────────────────

function pad2(n) {
  return String(n).padStart(2, '0');
}

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
  if (daysInclusive(desde, hasta) > 731) return { error: 'El rango máximo permitido es de 731 días (2 años).' };
  return {
    periodo: {
      desde: `${desde.getFullYear()}-${pad2(desde.getMonth() + 1)}-${pad2(desde.getDate())}`,
      hasta: `${hasta.getFullYear()}-${pad2(hasta.getMonth() + 1)}-${pad2(hasta.getDate())}`,
    },
  };
}

function throwValidation(msg) {
  const e = new Error(msg);
  e.code = 'VALIDATION';
  throw e;
}

function fmtDuracion(mins) {
  const n = Number(mins);
  if (!Number.isFinite(n) || n < 0) return '—';
  const total = Math.round(n);
  const h = Math.floor(total / 60);
  const m = total % 60;
  if (h <= 0) return `${m} min`;
  return `${h} h ${m} min`;
}

// ─── Consulta base: visitas (tickets + movimientos de membresía) ─────────────

async function fetchVisitas(periodo) {
  const rows = await executeSql(
    `SELECT * FROM (
       SELECT t.TIC_FECHA_HORA_ENTRADA AS FECHA_ENTRADA,
              t.TIC_FECHA_HORA_SALIDA  AS FECHA_SALIDA,
              'Esporádico' AS TIPO_CLIENTE,
              v.VEH_PLACA,
              ${vehiculoCatalogSelect('v')}
         FROM PAR_TICKET t
         JOIN PAR_VEHICULO v ON v.VEH_ID = t.VEH_ID
         ${vehiculoCatalogJoin('v')}
        WHERE TRUNC(t.TIC_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
          AND t.TIC_FECHA_HORA_ENTRADA IS NOT NULL
       UNION ALL
       SELECT r.RMM_FECHA_HORA_ENTRADA AS FECHA_ENTRADA,
              r.RMM_FECHA_HORA_SALIDA  AS FECHA_SALIDA,
              'Mensual' AS TIPO_CLIENTE,
              v.VEH_PLACA,
              ${vehiculoCatalogSelect('v')}
         FROM PAR_REGISTRO_MOVIMIENTO_MEMBRESIA r
         JOIN PAR_MEMBRESIA m ON m.MEM_ID = r.MEM_ID
         JOIN PAR_VEHICULO v ON v.VEH_ID = m.VEH_ID
         ${vehiculoCatalogJoin('v')}
        WHERE TRUNC(r.RMM_FECHA_HORA_ENTRADA) BETWEEN TO_DATE(:desde, 'YYYY-MM-DD') AND TO_DATE(:hasta, 'YYYY-MM-DD')
          AND r.RMM_FECHA_HORA_ENTRADA IS NOT NULL
     )`,
    periodo
  );

  return rows
    .map((r) => {
      const entrada = r.FECHA_ENTRADA ?? r.fecha_entrada;
      const salida = r.FECHA_SALIDA ?? r.fecha_salida;
      const d = entrada ? new Date(entrada) : null;
      if (!d || Number.isNaN(d.getTime())) return null;

      let estadiaMin = null;
      if (salida) {
        const ds = new Date(salida);
        if (!Number.isNaN(ds.getTime())) {
          const diff = (ds.getTime() - d.getTime()) / 60000;
          if (diff >= 0) estadiaMin = Math.round(diff);
        }
      }

      return {
        marca: (r.MAR_NOMBRE ?? r.mar_nombre) || '(Sin marca)',
        modelo: (r.VEH_MODELO ?? r.veh_modelo) || '(Sin modelo)',
        color: (r.VEH_COLOR ?? r.veh_color) || '(Sin color)',
        tipoVehiculo: (r.TVE_TIPO ?? r.tve_tipo) || '(Sin tipo)',
        tipoCliente: r.TIPO_CLIENTE ?? r.tipo_cliente ?? 'Esporádico',
        placa: (r.VEH_PLACA ?? r.veh_placa) || '—',
        hora: d.getHours(),
        diaSemana: d.getDay(),
        mes: d.getMonth() + 1,
        anio: d.getFullYear(),
        fecha: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
        estadiaMin,
      };
    })
    .filter(Boolean);
}

// ─── Endpoint JSON: datos crudos para manipulación en el cliente ─────────────

export async function getAnalisisFlota(desdeStr, hastaStr) {
  const v = validateRango(desdeStr, hastaStr);
  if (v.error) throwValidation(v.error);
  const visitas = await fetchVisitas(v.periodo);
  return {
    generadoEn: new Date().toISOString(),
    periodo: v.periodo,
    totalVisitas: visitas.length,
    visitas,
  };
}

// ─── Filtros (compartidos con la exportación PDF) ────────────────────────────

function normalizeFiltros(p = {}) {
  const norm = (x) => {
    const s = String(x ?? '').trim();
    return s && s !== 'Todos' ? s : '';
  };
  const toHora = (x) => {
    if (x === '' || x == null) return null;
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.min(23, Math.trunc(n)));
  };
  const toMinutos = (x) => {
    if (x === '' || x == null) return null;
    const n = Number(x);
    if (!Number.isFinite(n)) return null;
    return Math.max(0, Math.trunc(n));
  };
  return {
    tipoCliente: norm(p.tipoCliente),
    tipoVehiculo: norm(p.tipoVehiculo),
    marca: norm(p.marca),
    modelo: norm(p.modelo),
    color: norm(p.color),
    placa: norm(p.placa).toLowerCase(),
    diaSemana: norm(p.diaSemana),
    mes: norm(p.mes),
    horaIni: toHora(p.horaIni),
    horaFin: toHora(p.horaFin),
    estadiaMin: toMinutos(p.estadiaMin),
    estadiaMax: toMinutos(p.estadiaMax),
  };
}

function aplicarFiltros(visitas, f) {
  const hLo = f.horaIni != null && f.horaFin != null ? Math.min(f.horaIni, f.horaFin) : f.horaIni;
  const hHi = f.horaIni != null && f.horaFin != null ? Math.max(f.horaIni, f.horaFin) : f.horaFin;
  const eLo = f.estadiaMin != null && f.estadiaMax != null ? Math.min(f.estadiaMin, f.estadiaMax) : f.estadiaMin;
  const eHi = f.estadiaMin != null && f.estadiaMax != null ? Math.max(f.estadiaMin, f.estadiaMax) : f.estadiaMax;
  return visitas.filter((v) => {
    if (f.tipoCliente && v.tipoCliente !== f.tipoCliente) return false;
    if (f.tipoVehiculo && v.tipoVehiculo !== f.tipoVehiculo) return false;
    if (f.marca && v.marca !== f.marca) return false;
    if (f.modelo && v.modelo !== f.modelo) return false;
    if (f.color && v.color !== f.color) return false;
    if (f.placa && !String(v.placa || '').toLowerCase().includes(f.placa)) return false;
    if (f.diaSemana && String(v.diaSemana) !== String(f.diaSemana)) return false;
    if (f.mes && `${v.anio}-${pad2(v.mes)}` !== f.mes) return false;
    if (hLo != null && v.hora < hLo) return false;
    if (hHi != null && v.hora > hHi) return false;
    if (eLo != null && (v.estadiaMin == null || v.estadiaMin < eLo)) return false;
    if (eHi != null && (v.estadiaMin == null || v.estadiaMin > eHi)) return false;
    return true;
  });
}

// ─── Agregaciones ────────────────────────────────────────────────────────────

function rankingMarcas(visitas, limit) {
  const map = new Map();
  for (const v of visitas) map.set(v.marca, (map.get(v.marca) || 0) + 1);
  const total = visitas.length;
  const arr = [...map.entries()]
    .map(([marca, n]) => ({
      marca,
      visitas: n,
      porcentaje: total ? Math.round((n / total) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.visitas - a.visitas || a.marca.localeCompare(b.marca));
  return limit ? arr.slice(0, limit) : arr;
}

function liderPorClave(visitas, claveFn) {
  const buckets = new Map();
  for (const v of visitas) {
    const { key, label, orden } = claveFn(v);
    if (!buckets.has(key)) buckets.set(key, { label, orden, total: 0, marcas: new Map() });
    const b = buckets.get(key);
    b.total += 1;
    b.marcas.set(v.marca, (b.marcas.get(v.marca) || 0) + 1);
  }
  return [...buckets.values()]
    .sort((a, b) => a.orden - b.orden)
    .map((b) => {
      let marcaLider = '—';
      let visitasLider = 0;
      for (const [m, n] of b.marcas) {
        if (n > visitasLider) {
          visitasLider = n;
          marcaLider = m;
        }
      }
      return {
        franja: b.label,
        total: b.total,
        marcaLider,
        visitasLider,
        porcentaje: b.total ? Math.round((visitasLider / b.total) * 1000) / 10 : 0,
      };
    });
}

const claveHora = (v) => ({ key: v.hora, label: `${pad2(v.hora)}:00`, orden: v.hora });
const claveDia = (v) => ({ key: v.diaSemana, label: DIAS[v.diaSemana], orden: (v.diaSemana + 6) % 7 });
const claveMes = (v) => ({
  key: `${v.anio}-${pad2(v.mes)}`,
  label: `${MESES[v.mes - 1]} ${v.anio}`,
  orden: v.anio * 12 + v.mes,
});

function rankingMarcaColor(visitas, limit) {
  const map = new Map();
  for (const v of visitas) {
    const key = `${v.marca}__${v.color}`;
    if (!map.has(key)) map.set(key, { marca: v.marca, color: v.color, visitas: 0 });
    map.get(key).visitas += 1;
  }
  const total = visitas.length;
  const arr = [...map.values()]
    .map((x) => ({ ...x, porcentaje: total ? Math.round((x.visitas / total) * 1000) / 10 : 0 }))
    .sort((a, b) => b.visitas - a.visitas);
  return limit ? arr.slice(0, limit) : arr;
}

function statsPorMarca(visitas, limit) {
  const map = new Map();
  for (const v of visitas) {
    if (!map.has(v.marca)) {
      map.set(v.marca, { marca: v.marca, visitas: 0, estSuma: 0, estCount: 0, horas: Array(24).fill(0) });
    }
    const s = map.get(v.marca);
    s.visitas += 1;
    s.horas[v.hora] += 1;
    if (v.estadiaMin != null) {
      s.estSuma += v.estadiaMin;
      s.estCount += 1;
    }
  }
  const arr = [...map.values()]
    .map((s) => {
      let horaPico = 0;
      let visitasHoraPico = 0;
      s.horas.forEach((n, h) => {
        if (n > visitasHoraPico) {
          visitasHoraPico = n;
          horaPico = h;
        }
      });
      return {
        marca: s.marca,
        visitas: s.visitas,
        estadiaPromedioMin: s.estCount ? Math.round(s.estSuma / s.estCount) : null,
        estadiaPromedio: s.estCount ? fmtDuracion(s.estSuma / s.estCount) : '—',
        horaPico: visitasHoraPico > 0 ? `${pad2(horaPico)}:00` : '—',
        visitasHoraPico,
      };
    })
    .sort((a, b) => b.visitas - a.visitas);
  return limit ? arr.slice(0, limit) : arr;
}

function construirResumen(visitas) {
  return {
    rankingMarcas: rankingMarcas(visitas),
    porHora: liderPorClave(visitas, claveHora),
    porDia: liderPorClave(visitas, claveDia),
    porMes: liderPorClave(visitas, claveMes),
    marcaColor: rankingMarcaColor(visitas, 15),
    statsPorMarca: statsPorMarca(visitas),
  };
}

// ─── Exportación PDF ─────────────────────────────────────────────────────────

function renderPdf({ periodo, filtros, total, totalSinFiltro, resumen }) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    const doc = new PDFDocument({ margin: 40, size: 'A4' });
    doc.on('data', (c) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const right = doc.page.width - doc.page.margins.right;
    const width = right - left;

    const partesFiltro = [];
    if (filtros.tipoCliente) partesFiltro.push(`Tipo de cliente: ${filtros.tipoCliente}`);
    if (filtros.tipoVehiculo) partesFiltro.push(`Tipo de vehículo: ${filtros.tipoVehiculo}`);
    if (filtros.marca) partesFiltro.push(`Marca: ${filtros.marca}`);
    if (filtros.modelo) partesFiltro.push(`Modelo: ${filtros.modelo}`);
    if (filtros.color) partesFiltro.push(`Color: ${filtros.color}`);
    if (filtros.placa) partesFiltro.push(`Placa contiene: ${filtros.placa}`);
    if (filtros.diaSemana) partesFiltro.push(`Dia: ${DIAS[Number(filtros.diaSemana)] ?? filtros.diaSemana}`);
    if (filtros.mes) {
      const [anio, mes] = String(filtros.mes).split('-');
      partesFiltro.push(`Mes: ${MESES[Number(mes) - 1] ?? mes} ${anio}`);
    }
    if (filtros.horaIni != null || filtros.horaFin != null) {
      const a = filtros.horaIni != null ? `${pad2(filtros.horaIni)}:00` : '00:00';
      const b = filtros.horaFin != null ? `${pad2(filtros.horaFin)}:59` : '23:59';
      partesFiltro.push(`Franja horaria: ${a} - ${b}`);
    }
    if (filtros.estadiaMin != null || filtros.estadiaMax != null) {
      const a = filtros.estadiaMin != null ? `${filtros.estadiaMin} min` : '0 min';
      const b = filtros.estadiaMax != null ? `${filtros.estadiaMax} min` : 'sin maximo';
      partesFiltro.push(`Estadia: ${a} - ${b}`);
    }
    const filtroLabel = partesFiltro.length ? partesFiltro.join('   ·   ') : 'Sin filtros aplicados';

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#111827')
      .text('Reporte de análisis de marcas y franjas', left, 40, { width, align: 'center' });
    doc.moveDown(0.3);
    doc.font('Helvetica').fontSize(10).fillColor('#334155')
      .text(`Período: ${periodo.desde} al ${periodo.hasta}`, left, doc.y, { width, align: 'center' });
    doc.text(`Generado: ${new Date().toLocaleString('es-GT')}`, left, doc.y, { width, align: 'center' });
    doc.moveDown(0.15);
    doc.fontSize(8.5).fillColor('#475569')
      .text(filtroLabel, left, doc.y, { width, align: 'center' });
    doc.text(`Visitas analizadas: ${total} de ${totalSinFiltro} registradas en el período`, left, doc.y, {
      width,
      align: 'center',
    });
    doc.moveDown(0.3);

    const sectionTitle = (txt) => {
      if (doc.y > doc.page.height - 130) doc.addPage();
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold').fontSize(11).fillColor('#0f172a').text(txt, left, doc.y);
      const y = doc.y + 2;
      doc.moveTo(left, y).lineTo(right, y).strokeColor('#cbd5e1').lineWidth(1).stroke();
      doc.moveDown(0.4);
    };

    const drawTable = (headers, rows, ratios, aligns) => {
      const colW = ratios.map((r) => Math.floor(width * r));
      colW[colW.length - 1] = width - colW.slice(0, -1).reduce((s, n) => s + n, 0);
      const rowH = 16;
      const headerH = 18;
      const oneLine = (txt, w) => {
        let s = String(txt ?? '—').replace(/\s+/g, ' ').trim();
        const max = Math.max(3, Math.floor(w / 4.1));
        if (s.length > max) s = `${s.slice(0, max - 1)}…`;
        return s;
      };
      const headerRow = () => {
        const y = doc.y;
        doc.rect(left, y, width, headerH).fill('#e2e8f0');
        doc.fillColor('#0f172a').font('Helvetica-Bold').fontSize(8);
        let x = left;
        headers.forEach((h, i) => {
          doc.text(h, x + 4, y + 5, { width: colW[i] - 8, align: aligns[i] || 'left', lineBreak: false });
          x += colW[i];
        });
        doc.y = y + headerH;
      };
      headerRow();
      doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
      rows.forEach((row, idx) => {
        if (doc.y + rowH > doc.page.height - doc.page.margins.bottom) {
          doc.addPage();
          headerRow();
          doc.font('Helvetica').fontSize(8).fillColor('#0f172a');
        }
        const y = doc.y;
        if (idx % 2 === 0) doc.rect(left, y, width, rowH).fill('#f8fafc');
        doc.strokeColor('#e2e8f0').lineWidth(0.5).rect(left, y, width, rowH).stroke();
        let x = left;
        row.forEach((cell, i) => {
          doc.fillColor('#0f172a').font('Helvetica').fontSize(8)
            .text(oneLine(cell, colW[i]), x + 4, y + 4, {
              width: colW[i] - 8,
              align: aligns[i] || 'left',
              lineBreak: false,
            });
          x += colW[i];
        });
        doc.y = y + rowH;
      });
    };

    const emptyMsg = () => {
      doc.font('Helvetica').fontSize(9).fillColor('#64748b').text('Sin datos para los filtros seleccionados.');
    };

    sectionTitle('1. Ranking de marcas');
    if (!resumen.rankingMarcas.length) {
      emptyMsg();
    } else {
      drawTable(
        ['#', 'Marca', 'Visitas', '% del total'],
        resumen.rankingMarcas.map((r, i) => [String(i + 1), r.marca, String(r.visitas), `${r.porcentaje}%`]),
        [0.1, 0.5, 0.2, 0.2],
        ['left', 'left', 'right', 'right']
      );
    }

    const franjaTable = (titulo, filas) => {
      sectionTitle(titulo);
      if (!filas.length) {
        emptyMsg();
        return;
      }
      drawTable(
        ['Franja', 'Marca líder', 'Visitas de la marca', 'Total franja', '% de dominio'],
        filas.map((r) => [r.franja, r.marcaLider, String(r.visitasLider), String(r.total), `${r.porcentaje}%`]),
        [0.24, 0.3, 0.18, 0.14, 0.14],
        ['left', 'left', 'right', 'right', 'right']
      );
    };
    franjaTable('2. Marca líder por hora del día', resumen.porHora);
    franjaTable('3. Marca líder por día de la semana', resumen.porDia);
    franjaTable('4. Marca líder por mes', resumen.porMes);

    sectionTitle('5. Top combinaciones marca + color');
    if (!resumen.marcaColor.length) {
      emptyMsg();
    } else {
      drawTable(
        ['#', 'Marca', 'Color', 'Visitas', '% del total'],
        resumen.marcaColor.map((r, i) => [String(i + 1), r.marca, r.color, String(r.visitas), `${r.porcentaje}%`]),
        [0.1, 0.34, 0.26, 0.15, 0.15],
        ['left', 'left', 'left', 'right', 'right']
      );
    }

    sectionTitle('6. Estadía promedio y hora pico por marca');
    if (!resumen.statsPorMarca.length) {
      emptyMsg();
    } else {
      drawTable(
        ['Marca', 'Visitas', 'Estadía promedio', 'Hora pico', 'Visitas en la hora pico'],
        resumen.statsPorMarca.map((r) => [
          r.marca,
          String(r.visitas),
          r.estadiaPromedio,
          r.horaPico,
          String(r.visitasHoraPico),
        ]),
        [0.3, 0.15, 0.23, 0.16, 0.16],
        ['left', 'right', 'right', 'right', 'right']
      );
    }

    doc.end();
  });
}

export async function buildAnalisisFlotaPdfBuffer(params = {}) {
  const v = validateRango(params.desde, params.hasta);
  if (v.error) throwValidation(v.error);
  const todas = await fetchVisitas(v.periodo);
  const filtros = normalizeFiltros(params);
  const visitas = aplicarFiltros(todas, filtros);
  const resumen = construirResumen(visitas);
  return renderPdf({
    periodo: v.periodo,
    filtros,
    total: visitas.length,
    totalSinFiltro: todas.length,
    resumen,
  });
}
