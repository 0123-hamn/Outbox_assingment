import { Router } from 'express';
import { QueueController } from '../controllers/queueController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.get('/stats', authMiddleware, QueueController.getStats);

export default router;
