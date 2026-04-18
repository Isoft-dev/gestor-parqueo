import { Router } from 'express';
import * as ctrl from '../controllers/espacio.js';

const router = Router();

router.get('/resumen-publico', ctrl.getResumenPublico);
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);

export default router;
