import express from 'express';
import cors from 'cors';
import { PORT, isOracleConfigured } from './config.js';
import { ping } from './db/oracle.js';

import estadoEspacioRoutes from './routes/estadoEspacio.js';
import estadoMaquinaRoutes from './routes/estadoMaquina.js';
import tipoMaquinaRoutes from './routes/tipoMaquina.js';
import rolRoutes from './routes/rol.js';
import clienteRoutes from './routes/cliente.js';
import usuarioRoutes from './routes/usuario.js';
import espacioRoutes from './routes/espacio.js';
import vehiculoRoutes from './routes/vehiculo.js';
import tipoVehiculoRoutes from './routes/tipoVehiculo.js';
import registroMovimientoMembresiaRoutes from './routes/registroMovimientoMembresia.js';
import tipoMembresiaRoutes from './routes/tipoMembresia.js';
import estadoMembresiaRoutes from './routes/estadoMembresia.js';
import tipoCobroRoutes from './routes/tipoCobro.js';
import cobroRoutes from './routes/cobro.js';
import tarifaRoutes from './routes/tarifa.js';
import tipoAlertaRoutes from './routes/tipoAlerta.js';
import estadoAlertaRoutes from './routes/estadoAlerta.js';
import alertaRoutes from './routes/alerta.js';
import estadoTicketRoutes from './routes/estadoTicket.js';
import tipoNotificacionRoutes from './routes/tipoNotificacion.js';
import tipoPagoRoutes from './routes/tipoPago.js';
import incidenteRoutes from './routes/incidente.js';
import saldoDisponibleRoutes from './routes/saldoDisponible.js';
import maquinaRoutes from './routes/maquina.js';
import ticketRoutes from './routes/ticket.js';
import pagoRoutes from './routes/pago.js';
import membresiaRoutes from './routes/membresia.js';
import recargoMaquinaRoutes from './routes/recargoMaquina.js';
import registroMantenimientoRoutes from './routes/registroMantenimiento.js';
import detalleSaldoRoutes from './routes/detalleSaldo.js';
import detalleMaquinaTicketRoutes from './routes/detalleMaquinaTicket.js';
import detallePagoMembresiaRoutes from './routes/detallePagoMembresia.js';
import bitacoraIncidenteVehiculoRoutes from './routes/bitacoraIncidenteVehiculo.js';
import notificacionRoutes from './routes/notificacion.js';
import { startDailyJobs } from './jobs/dailyJobs.js';

const app = express();

app.use(cors());
app.use(express.json());

app.get('/api', (_req, res) => {
  res.json({ ok: true, message: 'Backend gestor-parqueo' });
});

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

app.use('/api/estado-espacio', estadoEspacioRoutes);
app.use('/api/estado-maquina', estadoMaquinaRoutes);
app.use('/api/tipo-maquina', tipoMaquinaRoutes);
app.use('/api/rol', rolRoutes);
app.use('/api/cliente', clienteRoutes);
app.use('/api/usuario', usuarioRoutes);
app.use('/api/espacio', espacioRoutes);
app.use('/api/vehiculo', vehiculoRoutes);
app.use('/api/tipo-vehiculo', tipoVehiculoRoutes);
app.use('/api/registro-movimiento-membresia', registroMovimientoMembresiaRoutes);
app.use('/api/tipo-membresia', tipoMembresiaRoutes);
app.use('/api/estado-membresia', estadoMembresiaRoutes);
app.use('/api/tipo-cobro', tipoCobroRoutes);
app.use('/api/cobro', cobroRoutes);
app.use('/api/tarifa', tarifaRoutes);
app.use('/api/tipo-alerta', tipoAlertaRoutes);
app.use('/api/estado-alerta', estadoAlertaRoutes);
app.use('/api/alerta', alertaRoutes);
app.use('/api/estado-ticket', estadoTicketRoutes);
app.use('/api/tipo-notificacion', tipoNotificacionRoutes);
app.use('/api/tipo-pago', tipoPagoRoutes);
app.use('/api/incidente', incidenteRoutes);
app.use('/api/saldo-disponible', saldoDisponibleRoutes);
app.use('/api/maquina', maquinaRoutes);
app.use('/api/ticket', ticketRoutes);
app.use('/api/pago', pagoRoutes);
app.use('/api/membresia', membresiaRoutes);
app.use('/api/recargo-maquina', recargoMaquinaRoutes);
app.use('/api/registro-mantenimiento', registroMantenimientoRoutes);
app.use('/api/detalle-saldo', detalleSaldoRoutes);
app.use('/api/detalle-maquina-ticket', detalleMaquinaTicketRoutes);
app.use('/api/detalle-pago-membresia', detallePagoMembresiaRoutes);
app.use('/api/bitacora-incidente-vehiculo', bitacoraIncidenteVehiculoRoutes);
app.use('/api/notificacion', notificacionRoutes);

app.listen(PORT, () => {
  console.log(`Servidor en http://localhost:${PORT}`);
  startDailyJobs();
});
