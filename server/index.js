import express from 'express';
import cors from 'cors';
import { PORT } from './config.js';

const app = express();

app.use(cors());
app.use(express.json());

// Ruta mínima para comprobar que el servidor responde.
// Aquí irán luego las rutas cuando conectes la DB y hagas el CRUD.
app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'Backend gestor-parqueo' });
});

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
});
