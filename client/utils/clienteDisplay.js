export function clienteNombreCompleto(row) {
  return [
    row?.CLI_PRIMER_NOMBRE,
    row?.CLI_SEGUNDO_NOMBRE,
    row?.CLI_PRIMER_APELLIDO,
    row?.CLI_SEGUNDO_APELLIDO,
  ]
    .map((x) => String(x ?? '').trim())
    .filter(Boolean)
    .join(' ');
}

export function clienteDireccionCompacta(row) {
  const parts = [
    row?.CLI_ZONA ? `Zona ${row.CLI_ZONA}` : '',
    row?.CLI_CALLE ? `Calle ${row.CLI_CALLE}` : '',
    row?.CLI_NUMERO ? `No. ${row.CLI_NUMERO}` : '',
    row?.CLI_COLONIA ? `Col. ${row.CLI_COLONIA}` : '',
    row?.CLI_CIUDAD ? String(row.CLI_CIUDAD) : '',
    row?.CLI_CODIGO_POSTAL ? `CP ${row.CLI_CODIGO_POSTAL}` : '',
  ]
    .map((item) => String(item ?? '').trim())
    .filter(Boolean);
  return parts.join(', ');
}

export function getClienteFichaItems(row) {
  const activo = Number(row?.CLI_ACTIVO ?? 1) === 1;
  return [
    { label: 'Nombre completo', value: clienteNombreCompleto(row) || '—' },
    { label: 'DPI', value: row?.CLI_DPI || '—' },
    { label: 'NIT', value: row?.CLI_NIT || '—' },
    { label: 'Teléfono', value: row?.CLI_TELEFONO || '—' },
    { label: 'Correo', value: row?.CLI_CORREO || '—' },
    { label: 'Dirección', value: clienteDireccionCompacta(row) || '—' },
    { label: 'Estado', value: activo ? 'Activo' : 'Inactivo', tone: activo ? 'ok' : 'muted' },
  ];
}
