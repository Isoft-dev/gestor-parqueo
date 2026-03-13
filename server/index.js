import express from 'express';
import cors from 'cors';
import { PORT, isOracleConfigured } from './config.js';
import { ping } from './db/oracle.js';

const app = express();

app.use(cors());
app.use(express.json());

// Ruta mínima para comprobar que el servidor responde.
app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'Backend gestor-parqueo' });
});

// Health: estado del API y conexión Oracle (si está configurada).
app.get('/api/health', async (_req, res) => {
  const payload = { ok: true, oracle: false };
  if (isOracleConfigured()) {
    try {
      await ping();
      payload.oracle = true;
    } catch (err) {
      payload.oracle = false;
      payload.oracleError = err.message;
    }
  }
  res.json(payload);
});

// Aquí montarás las rutas de CRUD: app.use('/api/espacios', espaciosRoutes); etc.

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
