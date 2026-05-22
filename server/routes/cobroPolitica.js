import { Router } from 'express';
import * as controller from '../controllers/cobroPolitica.js';

const router = Router();

router.get('/', controller.get);
router.put('/', controller.put);
router.delete('/', controller.remove);

export default router;
