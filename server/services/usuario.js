import crypto from 'crypto';
import { executeProcedure, executeSql } from '../db/oracle.js';

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function hashPassword(password) {
  // Formato compacto para caber en USU_PASSWORD (max 100 chars)
  const salt = crypto.randomBytes(12).toString('base64');
  const hash = crypto.scryptSync(String(password), salt, 32).toString('base64');
  return `scrypt$${salt}$${hash}`;
}

function verifyPassword(plain, stored) {
  if (!stored) return false;
  const value = String(stored);
  if (!value.startsWith('scrypt$')) return String(plain) === value;
  const [, salt, hash] = value.split('$');
  if (!salt || !hash) return false;
  const calc = crypto.scryptSync(String(plain), salt, 32).toString('base64');
  // Evita RangeError en timingSafeEqual cuando el hash persistido tiene tamaño inesperado.
  if (calc.length !== hash.length) return false;
  return crypto.timingSafeEqual(Buffer.from(calc), Buffer.from(hash));
}

export async function getAll() {
  return executeSql(
    `SELECT u.USU_ID, u.USU_PRIMER_NOMBRE, u.USU_SEGUNDO_NOMBRE,
            u.USU_PRIMER_APELLIDO, u.USU_SEGUNDO_APELLIDO, u.USU_CORREO,
            u.USU_TELEFONO, u.ROL_ID, r.ROL_TIPO, u.USU_ACTIVO,
            u.USU_FECHA_CREACION, u.USU_FECHA_ACTUALIZACION
       FROM PAR_USUARIO u
       LEFT JOIN PAR_ROL r ON r.ROL_ID = u.ROL_ID
      ORDER BY u.USU_ID`
  );
}

export async function getById(id) {
  const rows = await executeSql(
    `SELECT u.USU_ID, u.USU_PRIMER_NOMBRE, u.USU_SEGUNDO_NOMBRE,
            u.USU_PRIMER_APELLIDO, u.USU_SEGUNDO_APELLIDO, u.USU_CORREO,
            u.USU_TELEFONO, u.ROL_ID, r.ROL_TIPO, u.USU_ACTIVO,
            u.USU_FECHA_CREACION, u.USU_FECHA_ACTUALIZACION
       FROM PAR_USUARIO u
       LEFT JOIN PAR_ROL r ON r.ROL_ID = u.ROL_ID
      WHERE u.USU_ID = :id`,
    { id }
  );
  return rows[0] || null;
}

async function findByEmail(email) {
  const rows = await executeSql(
    `SELECT USU_ID, USU_CORREO
       FROM PAR_USUARIO
      WHERE LOWER(USU_CORREO) = :correo`,
    { correo: normalizeEmail(email) }
  );
  return rows[0] || null;
}

async function isUsuarioIdIdentityAlways() {
  const rows = await executeSql(
    `SELECT GENERATION_TYPE
       FROM USER_TAB_IDENTITY_COLS
      WHERE TABLE_NAME='PAR_USUARIO' AND COLUMN_NAME='USU_ID'`
  );
  return String(rows[0]?.GENERATION_TYPE || '').toUpperCase() === 'ALWAYS';
}

export async function create(data) {
  const existingMail = await findByEmail(data.USU_CORREO);
  if (existingMail) throw new Error('Ya existe un usuario con el mismo USU_CORREO');

  const hashedPassword = hashPassword(data.USU_PASSWORD);
  const correo = normalizeEmail(data.USU_CORREO);
  const useIdentityFallback = await isUsuarioIdIdentityAlways();
  if (useIdentityFallback || !data.USU_ID) {
    await executeSql(
      `INSERT INTO PAR_USUARIO (
        USU_PRIMER_NOMBRE, USU_SEGUNDO_NOMBRE, USU_PRIMER_APELLIDO, USU_SEGUNDO_APELLIDO,
        USU_CORREO, USU_PASSWORD, USU_TELEFONO, ROL_ID, USU_ACTIVO, USU_FECHA_CREACION
      ) VALUES (
        :USU_PRIMER_NOMBRE, :USU_SEGUNDO_NOMBRE, :USU_PRIMER_APELLIDO, :USU_SEGUNDO_APELLIDO,
        :USU_CORREO, :USU_PASSWORD, :USU_TELEFONO, :ROL_ID, :USU_ACTIVO, SYSDATE
      )`,
      {
        USU_PRIMER_NOMBRE: data.USU_PRIMER_NOMBRE,
        USU_SEGUNDO_NOMBRE: data.USU_SEGUNDO_NOMBRE ?? null,
        USU_PRIMER_APELLIDO: data.USU_PRIMER_APELLIDO,
        USU_SEGUNDO_APELLIDO: data.USU_SEGUNDO_APELLIDO ?? null,
        USU_CORREO: correo,
        USU_PASSWORD: hashedPassword,
        USU_TELEFONO: data.USU_TELEFONO ?? null,
        ROL_ID: data.ROL_ID,
        USU_ACTIVO: data.USU_ACTIVO ?? 1,
      },
      { autoCommit: true }
    );
    const last = await executeSql(
      `SELECT USU_ID FROM PAR_USUARIO WHERE LOWER(USU_CORREO) = :correo ORDER BY USU_ID DESC`,
      { correo }
    );
    return last[0] ? getById(last[0].USU_ID) : null;
  }

  await executeProcedure(
    `BEGIN SP_USUARIO_CREATE(
      :USU_ID, :USU_PRIMER_NOMBRE, :USU_SEGUNDO_NOMBRE,
      :USU_PRIMER_APELLIDO, :USU_SEGUNDO_APELLIDO, :USU_CORREO,
      :USU_PASSWORD, :USU_TELEFONO, :ROL_ID, :USU_ACTIVO
    ); END;`,
    {
      USU_ID: data.USU_ID,
      USU_PRIMER_NOMBRE: data.USU_PRIMER_NOMBRE,
      USU_SEGUNDO_NOMBRE: data.USU_SEGUNDO_NOMBRE ?? null,
      USU_PRIMER_APELLIDO: data.USU_PRIMER_APELLIDO,
      USU_SEGUNDO_APELLIDO: data.USU_SEGUNDO_APELLIDO ?? null,
      USU_CORREO: correo,
      USU_PASSWORD: hashedPassword,
      USU_TELEFONO: data.USU_TELEFONO ?? null,
      ROL_ID: data.ROL_ID,
      USU_ACTIVO: data.USU_ACTIVO ?? 1,
    }
  );
  return getById(data.USU_ID);
}

export async function update(id, data) {
  const existingMail = await findByEmail(data.USU_CORREO);
  if (existingMail && String(existingMail.USU_ID) !== String(id)) {
    throw new Error('Ya existe un usuario con el mismo USU_CORREO');
  }
  await executeProcedure(
    `BEGIN SP_USUARIO_UPDATE(
      :id, :USU_PRIMER_NOMBRE, :USU_SEGUNDO_NOMBRE,
      :USU_PRIMER_APELLIDO, :USU_SEGUNDO_APELLIDO, :USU_CORREO,
      :USU_TELEFONO, :ROL_ID, :USU_ACTIVO
    ); END;`,
    {
      id,
      USU_PRIMER_NOMBRE: data.USU_PRIMER_NOMBRE,
      USU_SEGUNDO_NOMBRE: data.USU_SEGUNDO_NOMBRE ?? null,
      USU_PRIMER_APELLIDO: data.USU_PRIMER_APELLIDO,
      USU_SEGUNDO_APELLIDO: data.USU_SEGUNDO_APELLIDO ?? null,
      USU_CORREO: normalizeEmail(data.USU_CORREO),
      USU_TELEFONO: data.USU_TELEFONO ?? null,
      ROL_ID: data.ROL_ID,
      USU_ACTIVO: data.USU_ACTIVO,
    }
  );
  return getById(id);
}

export async function login(data) {
  const correo = normalizeEmail(data.USU_CORREO);
  const rows = await executeSql(
    `SELECT u.USU_ID, u.USU_PRIMER_NOMBRE, u.USU_PRIMER_APELLIDO, u.USU_CORREO, u.USU_PASSWORD,
            u.USU_ACTIVO, u.ROL_ID, r.ROL_TIPO
       FROM PAR_USUARIO u
       LEFT JOIN PAR_ROL r ON r.ROL_ID = u.ROL_ID
      WHERE LOWER(TRIM(u.USU_CORREO)) = :correo`,
    { correo }
  );
  const user = rows[0];
  if (!user) throw new Error('Credenciales invalidas');
  if (Number(user.USU_ACTIVO ?? 1) !== 1) throw new Error('Usuario desactivado');
  if (!verifyPassword(data.USU_PASSWORD, user.USU_PASSWORD)) throw new Error('Credenciales invalidas');
  return {
    USU_ID: user.USU_ID,
    USU_PRIMER_NOMBRE: user.USU_PRIMER_NOMBRE,
    USU_PRIMER_APELLIDO: user.USU_PRIMER_APELLIDO,
    USU_CORREO: user.USU_CORREO,
    USU_ACTIVO: user.USU_ACTIVO,
    ROL_ID: user.ROL_ID,
    ROL_TIPO: user.ROL_TIPO ?? null,
  };
}
