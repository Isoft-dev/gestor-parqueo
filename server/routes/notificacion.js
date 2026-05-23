import { Router } from 'express';
import * as ctrl from '../controllers/notificacion.js';
const router = Router();
// Bandeja simulada y ejecucion manual del job (deben declararse antes de '/:id').
router.get('/inbox', ctrl.getInbox);
router.post('/jobs/run', ctrl.runJobsNow);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
export default router;
