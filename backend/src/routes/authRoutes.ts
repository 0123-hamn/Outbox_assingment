import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { authMiddleware } from '../middlewares/auth.js';

const router = Router();

router.get('/google', AuthController.googleLogin);
router.get('/google/callback', AuthController.googleCallback);
router.get('/me', authMiddleware, AuthController.getMe);
router.post('/logout', authMiddleware, AuthController.logout);
router.post('/dev-login', AuthController.devLogin);

export default router;
