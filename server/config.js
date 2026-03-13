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
