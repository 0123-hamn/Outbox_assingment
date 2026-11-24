import { Router } from 'express';
import { SlackController } from '../controllers/slackController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.get('/connect', authMiddleware, SlackController.connect);
router.get('/callback', authMiddleware, SlackController.callback);
router.get('/status', authMiddleware, SlackController.status);
router.post('/disconnect', authMiddleware, SlackController.disconnect);

export default router;
