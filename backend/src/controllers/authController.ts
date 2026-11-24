import { Request, Response } from 'express';
import crypto from 'crypto';
import { GoogleAuthService } from '../integrations/google/index.js';
import { generateJwtToken } from '../middlewares/auth.js';
import { config } from '../config/index.js';
import prisma from '../config/prisma.js';

export class AuthController {
  public static async googleLogin(req: Request, res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('oauth_state', state, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
    });
    const url = GoogleAuthService.getAuthUrl(state);
    return res.redirect(url);
  }

  public static async googleCallback(req: Request, res: Response) {
    const { code, state } = req.query;
    const cookieState = req.cookies?.oauth_state;

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.FRONTEND_URL}/login?error=missing_code`);
    }

    if (cookieState && state && cookieState !== state) {
      return res.redirect(`${config.FRONTEND_URL}/login?error=invalid_state`);
    }

    try {
      const user = await GoogleAuthService.handleCallback(code);
      const token = generateJwtToken(user);

      res.cookie('reachinbox_token', token, {
        httpOnly: true,
        secure: config.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });

      return res.redirect(`${config.FRONTEND_URL}/dashboard`);
    } catch (err: any) {
      return res.redirect(`${config.FRONTEND_URL}/login?error=${encodeURIComponent(err.message)}`);
    }
  }

  public static async getMe(req: Request, res: Response) {
    return res.json({ success: true, user: req.user });
  }

  public static async logout(req: Request, res: Response) {
    res.clearCookie('reachinbox_token');
    return res.json({ success: true, message: 'Logged out successfully' });
  }

  /**
   * Development login fallback for local testing when GOOGLE_CLIENT_ID is not configured
   */
  public static async devLogin(req: Request, res: Response) {
    if (config.NODE_ENV === 'production') {
      return res.status(403).json({ success: false, error: 'Forbidden in production' });
    }

    const email = req.body?.email || 'demo.user@reachinbox.ai';
    const name = req.body?.name || 'Demo Engineer';

    let user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: `dev_${Date.now()}`,
          email,
          name,
          avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop',
        },
      });
    }

    // Default sender
    const sender = await prisma.emailSender.findFirst({ where: { userId: user.id } });
    if (!sender) {
      await prisma.emailSender.create({
        data: {
          userId: user.id,
          senderName: user.name,
          senderEmail: user.email,
          isActive: true,
        },
      });
    }

    const token = generateJwtToken(user);
    res.cookie('reachinbox_token', token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.json({ success: true, token, user });
  }
}
