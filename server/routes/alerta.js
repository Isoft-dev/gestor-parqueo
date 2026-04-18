import { Router } from 'express';
import * as ctrl from '../controllers/alerta.js';

const router = Router();

router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
router.put('/:id', ctrl.update);

export default router;
