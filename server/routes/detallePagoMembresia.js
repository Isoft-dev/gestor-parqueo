import { Router } from 'express';
import * as ctrl from '../controllers/detallePagoMembresia.js';
const router = Router();
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
export default router;
