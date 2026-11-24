import { Request, Response } from 'express';
import crypto from 'crypto';
import { SlackService } from '../integrations/slack/index.js';
import prisma from '../config/prisma.js';
import { config } from '../config/index.js';

export class SlackController {
  public static async connect(req: Request, res: Response) {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('slack_oauth_state', state, {
      httpOnly: true,
      secure: config.NODE_ENV === 'production',
      maxAge: 10 * 60 * 1000,
    });

    const url = SlackService.getAuthorizeUrl(state);
    return res.redirect(url);
  }

  public static async callback(req: Request, res: Response) {
    const { code, state } = req.query;
    const cookieState = req.cookies?.slack_oauth_state;

    if (!code || typeof code !== 'string') {
      return res.redirect(`${config.FRONTEND_URL}/dashboard?slack_error=missing_code`);
    }

    if (cookieState && state && cookieState !== state) {
      return res.redirect(`${config.FRONTEND_URL}/dashboard?slack_error=invalid_state`);
    }

    try {
      await SlackService.handleOAuthCallback(code, req.user!.id);
      return res.redirect(`${config.FRONTEND_URL}/dashboard?slack=connected`);
    } catch (err: any) {
      return res.redirect(`${config.FRONTEND_URL}/dashboard?slack_error=${encodeURIComponent(err.message)}`);
    }
  }

  public static async status(req: Request, res: Response) {
    const integration = await prisma.slackIntegration.findUnique({
      where: { userId: req.user!.id },
      select: {
        teamId: true,
        teamName: true,
        channelName: true,
        connectedAt: true,
      },
    });

    return res.json({
      success: true,
      connected: !!integration,
      integration: integration || null,
    });
  }

  public static async disconnect(req: Request, res: Response) {
    await prisma.slackIntegration.deleteMany({
      where: { userId: req.user!.id },
    });

    return res.json({ success: true, message: 'Slack disconnected successfully' });
  }
}
