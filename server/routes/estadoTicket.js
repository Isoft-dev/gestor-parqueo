import { Router } from 'express';
import * as ctrl from '../controllers/estadoTicket.js';
const router = Router();
router.get('/', ctrl.getAll);
router.get('/:id', ctrl.getById);
router.post('/', ctrl.create);
export default router;
