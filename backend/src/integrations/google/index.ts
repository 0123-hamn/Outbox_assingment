import { OAuth2Client } from 'google-auth-library';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import prisma from '../../config/prisma.js';

export class GoogleAuthService {
  private static client = new OAuth2Client(
    config.GOOGLE_CLIENT_ID,
    config.GOOGLE_CLIENT_SECRET,
    config.GOOGLE_CALLBACK_URL
  );

  /**
   * Generate Google OAuth redirect URL
   */
  public static getAuthUrl(state: string): string {
    return this.client.generateAuthUrl({
      access_type: 'offline',
      scope: ['profile', 'email'],
      state,
      prompt: 'consent',
    });
  }

  /**
   * Exchange callback code for tokens and upsert user in database
   */
  public static async handleCallback(code: string): Promise<any> {
    try {
      const { tokens } = await this.client.getToken(code);
      this.client.setCredentials(tokens);

      // Verify Google ID token
      const ticket = await this.client.verifyIdToken({
        idToken: tokens.id_token!,
        audience: config.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      if (!payload || !payload.email || !payload.sub) {
        throw new Error('Invalid Google token payload');
      }

      // Upsert user in PostgreSQL
      const user = await prisma.user.upsert({
        where: { googleId: payload.sub },
        update: {
          name: payload.name || 'Google User',
          email: payload.email,
          avatar: payload.picture,
        },
        create: {
          googleId: payload.sub,
          name: payload.name || 'Google User',
          email: payload.email,
          avatar: payload.picture,
        },
      });

      // Ensure user has at least one default sender profile (their own email)
      const existingSender = await prisma.emailSender.findFirst({
        where: { userId: user.id },
      });

      if (!existingSender) {
        await prisma.emailSender.create({
          data: {
            userId: user.id,
            senderName: user.name,
            senderEmail: user.email,
            isActive: true,
          },
        });
      }

      return user;
    } catch (err: any) {
      logger.error(`Google authentication error: ${err.message}`);
      throw err;
    }
  }
}
