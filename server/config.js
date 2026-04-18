import 'dotenv/config';

export const PORT = process.env.PORT || 3001;

/** Configuración Oracle (gestorParqueo). Se lee desde variables de entorno. */
export const oracleConfig = {
  user: process.env.ORACLE_USER,
  password: process.env.ORACLE_PASSWORD,
  connectString: process.env.ORACLE_CONNECT_STRING,
};

export function isOracleConfigured() {
  return !!(
    oracleConfig.user &&
    oracleConfig.password &&
    oracleConfig.connectString
  );
}

const envBool = (v) =>
  String(v ?? '')
    .trim()
    .toLowerCase() === '1' ||
  String(v ?? '')
    .trim()
    .toLowerCase() === 'true';

/** Por defecto desde .env; el panel admin puede sobreescribir vía `server/data/cobro-politica.json`. */
export const COBRO_MINIMO_SUB_1H_ENABLED_DEFAULT = envBool(
  process.env.COBRO_MINIMO_SUB_1H_ENABLED,
);
export const COBRO_MINIMO_SUB_1H_QUETZALES_DEFAULT = Number(
  process.env.COBRO_MINIMO_SUB_1H_QUETZALES ?? 5,
) || 5;
