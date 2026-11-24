import { Router } from 'express';
import { SenderController } from '../controllers/senderController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.use(authMiddleware);

router.get('/', SenderController.list);
router.post('/', SenderController.create);
router.patch('/:id', SenderController.update);
router.delete('/:id', SenderController.delete);

export default router;
