export function vehiculoCatalogJoin(alias = 'v') {
  return `
    LEFT JOIN PAR_MODELO_VEHICULO mod ON ${alias}.MOD_ID = mod.MOD_ID
    LEFT JOIN PAR_MARCA_VEHICULO mar ON mod.MAR_ID = mar.MAR_ID
    LEFT JOIN PAR_TIPO_VEHICULO tv ON mod.TVE_ID = tv.TVE_ID
    LEFT JOIN PAR_COLOR_VEHICULO col ON ${alias}.COL_ID = col.COL_ID
  `;
}

export function vehiculoCatalogSelect(alias = 'v') {
  return `
    ${alias}.MOD_ID,
    mod.MOD_NOMBRE AS VEH_MODELO,
    ${alias}.COL_ID,
    col.COL_NOMBRE AS VEH_COLOR,
    mod.TVE_ID AS TVE_ID,
    tv.TVE_TIPO,
    mod.MAR_ID AS MAR_ID,
    mar.MAR_NOMBRE
  `;
}

export function vehiculoCatalogGroupBy(alias = 'v') {
  return `
    ${alias}.MOD_ID,
    mod.MOD_NOMBRE,
    ${alias}.COL_ID,
    col.COL_NOMBRE,
    mod.TVE_ID,
    tv.TVE_TIPO,
    mod.MAR_ID,
    mar.MAR_NOMBRE
  `;
}
