import { Router } from 'express';
import { EmailController } from '../controllers/emailController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.use(authMiddleware);

router.post('/schedule', EmailController.schedule);
router.get('/scheduled', EmailController.getScheduled);
router.get('/sent', EmailController.getSent);
router.get('/search', EmailController.search);
router.get('/stats', EmailController.getStats);
router.get('/:id', EmailController.getById);
router.post('/:id/cancel', EmailController.cancel);

export default router;
