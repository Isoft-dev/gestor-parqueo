import { Router } from 'express';
import * as ctrl from '../controllers/reportes.js';

const router = Router();

router.get('/incidentes/pdf', ctrl.incidentesPorRangoPdf);
router.get('/incidentes', ctrl.incidentesPorRango);
router.get('/incidentes-por-tipo/pdf', ctrl.incidentesPorTipoPdf);
router.get('/incidentes-por-tipo', ctrl.incidentesPorTipo);
router.get('/incidentes-por-resolucion/pdf', ctrl.incidentesPorResolucionPdf);
router.get('/incidentes-por-resolucion', ctrl.incidentesPorResolucion);
router.get('/membresias-estado/pdf', ctrl.membresiasEstadoPdf);
router.get('/membresias-estado', ctrl.membresiasEstado);
router.get('/clientes-mora/pdf', ctrl.clientesMoraPdf);
router.get('/clientes-mora', ctrl.clientesMora);

export default router;
