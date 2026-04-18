import { Router } from 'express';
import * as ctrl from '../controllers/recargoMaquina.js';
const router = Router();
router.get('/', ctrl.getAll);
router.get('/maquina/:maqId', ctrl.getByMachine);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
export default router;
