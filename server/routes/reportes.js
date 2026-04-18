import { Router } from 'express';
import * as ctrl from '../controllers/reportes.js';

const router = Router();

router.get('/incidentes/pdf', ctrl.incidentesPorRangoPdf);
router.get('/incidentes', ctrl.incidentesPorRango);
router.get('/incidentes-por-tipo/pdf', ctrl.incidentesPorTipoPdf);
router.get('/incidentes-por-tipo', ctrl.incidentesPorTipo);
router.get('/incidentes-por-resolucion/pdf', ctrl.incidentesPorResolucionPdf);
router.get('/incidentes-por-resolucion', ctrl.incidentesPorResolucion);

export default router;
