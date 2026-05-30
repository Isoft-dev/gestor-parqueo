/**
 * Utilidad de exportación a Excel para el módulo de Reportes.
 *
 * Genera archivos .xlsx en el navegador a partir de los datos que ya
 * están cargados en cada reporte: exporta exactamente lo que se ve en
 * pantalla, respetando los filtros aplicados.
 *
 * Requiere la dependencia "xlsx" (SheetJS). Si no está instalada,
 * ejecutar en la carpeta client/:  npm install
 *
 * La librería se carga de forma diferida (import dinámico) para no
 * aumentar el tamaño del bundle principal.
 */

const NOMBRE_HOJA_MAX = 31;
const CARACTERES_INVALIDOS = /[\\/?*[\]:]/g;

/** Normaliza el nombre de una hoja según las reglas de Excel. */
function normalizarNombreHoja(nombre, indice) {
  const limpio = String(nombre || `Hoja ${indice + 1}`)
    .replace(CARACTERES_INVALIDOS, ' ')
    .trim();
  return (limpio || `Hoja ${indice + 1}`).slice(0, NOMBRE_HOJA_MAX);
}

/**
 * Construye la definición de una hoja "Resumen" con pares indicador / valor.
 * @param {string} nombre Nombre de la hoja.
 * @param {{ etiqueta: string, valor: * }[]} pares Indicadores a listar.
 */
export function hojaResumen(nombre, pares) {
  return {
    nombre,
    filas: Array.isArray(pares) ? pares : [],
    columnas: [
      { key: 'etiqueta', header: 'Indicador' },
      { key: 'valor', header: 'Valor' },
    ],
  };
}

/**
 * Convierte una definición de hoja en una matriz (array de arrays).
 * Si la hoja trae `columnas` se respeta ese orden y encabezados; de lo
 * contrario se usan las claves del primer registro.
 */
function hojaAMatriz({ filas, columnas }) {
  const datos = Array.isArray(filas) ? filas : [];
  let cols = columnas;
  if (!cols || !cols.length) {
    const claves = datos.length ? Object.keys(datos[0]) : [];
    cols = claves.map((k) => ({ key: k, header: k }));
  }
  const matriz = [cols.map((c) => c.header)];
  datos.forEach((fila) => {
    matriz.push(
      cols.map((c) => {
        const valor = fila ? fila[c.key] : undefined;
        return valor === undefined || valor === null ? '' : valor;
      })
    );
  });
  return matriz;
}

/** Estima el ancho de cada columna a partir del contenido. */
function calcularAnchos(matriz) {
  if (!matriz.length) return [];
  const anchos = new Array(matriz[0].length).fill(10);
  matriz.forEach((fila) => {
    fila.forEach((celda, i) => {
      const largo = String(celda == null ? '' : celda).length + 2;
      if (largo > anchos[i]) anchos[i] = Math.min(largo, 48);
    });
  });
  return anchos.map((wch) => ({ wch }));
}

/**
 * Genera y descarga un archivo .xlsx con una o varias hojas.
 *
 * @param {Object} opciones
 * @param {string} opciones.nombreArchivo Nombre del archivo (sin extensión).
 * @param {{ nombre: string, filas: Object[], columnas?: { key: string, header: string }[] }[]} opciones.hojas
 */
export async function descargarExcel({ nombreArchivo, hojas }) {
  let modulo;
  try {
    modulo = await import('xlsx');
  } catch {
    throw new Error(
      'No se encontró la librería "xlsx". Ejecuta "npm install" en la carpeta client/.'
    );
  }
  const XLSX = modulo && modulo.utils ? modulo : modulo && modulo.default;
  if (!XLSX || !XLSX.utils) {
    throw new Error('La librería "xlsx" no se cargó correctamente.');
  }

  const listaHojas = Array.isArray(hojas) ? hojas.filter(Boolean) : [];
  if (!listaHojas.length) {
    throw new Error('No hay datos para exportar.');
  }

  const libro = XLSX.utils.book_new();
  listaHojas.forEach((hoja, indice) => {
    const matriz = hojaAMatriz(hoja);
    const ws = XLSX.utils.aoa_to_sheet(matriz);
    ws['!cols'] = calcularAnchos(matriz);
    XLSX.utils.book_append_sheet(libro, ws, normalizarNombreHoja(hoja.nombre, indice));
  });

  const base = String(nombreArchivo || 'reporte').replace(CARACTERES_INVALIDOS, '-');
  XLSX.writeFile(libro, `${base}.xlsx`);
}
