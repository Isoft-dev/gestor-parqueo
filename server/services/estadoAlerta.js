import { executeCursor, executeProcedure } from '../db/oracle.js';

export async function getAll() {
<<<<<<< HEAD
  return executeCursor(
    `BEGIN SP_ESTADO_ALERTA_GET_ALL(:cursor); END;`
  );
}

export async function getById(id) {
  const rows = await executeCursor(
    `BEGIN SP_ESTADO_ALERTA_GET_BY_ID(:id, :cursor); END;`,
    { id }
  );
=======
  return executeCursor(`BEGIN SP_ESTADO_ALERTA_GET_ALL(:cursor); END;`);
}

export async function getById(id) {
  const rows = await executeCursor(`BEGIN SP_ESTADO_ALERTA_GET_BY_ID(:id, :cursor); END;`, { id });
>>>>>>> 7201aaf1947b037e8bed0619c18efd831d4ccfe7
  return rows[0] || null;
}

export async function create(data) {
<<<<<<< HEAD
  await executeProcedure(
    `BEGIN SP_ESTADO_ALERTA_CREATE(
      :EAL_ID, :EAL_ESTADO, :EAL_DESCRIPCION
    ); END;`,
    {
      EAL_ID: data.EAL_ID,
      EAL_ESTADO: data.EAL_ESTADO,
      EAL_DESCRIPCION: data.EAL_DESCRIPCION ?? null,
    }
  );
  return getById(data.EAL_ID);
}
=======
  await executeProcedure(`BEGIN SP_ESTADO_ALERTA_CREATE(:EAL_ID, :EAL_ESTADO, :EAL_DESCRIPCION); END;`, {
    EAL_ID: data.EAL_ID ?? null,
    EAL_ESTADO: data.EAL_ESTADO ?? null,
    EAL_DESCRIPCION: data.EAL_DESCRIPCION ?? null,
  });
  return getById(data.EAL_ID);
}

>>>>>>> 7201aaf1947b037e8bed0619c18efd831d4ccfe7
