import { WebClient } from '@slack/web-api';
import { config } from '../../config/index.js';
import { logger } from '../../utils/logger.js';
import { decrypt, encrypt } from '../../utils/crypto.js';
import prisma from '../../config/prisma.js';

export class SlackService {
  /**
   * Generate Slack OAuth authorization URL
   */
  public static getAuthorizeUrl(state: string): string {
    const scopes = ['chat:write', 'channels:read', 'groups:read', 'im:read', 'mpim:read'];
    const params = new URLSearchParams({
      client_id: config.SLACK_CLIENT_ID,
      scope: scopes.join(','),
      redirect_uri: config.SLACK_REDIRECT_URI,
      state,
    });
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }

  /**
   * Handle Slack OAuth callback and save integration
   */
  public static async handleOAuthCallback(code: string, userId: string): Promise<any> {
    try {
      const client = new WebClient();
      const response = await client.oauth.v2.access({
        client_id: config.SLACK_CLIENT_ID,
        client_secret: config.SLACK_CLIENT_SECRET,
        code,
        redirect_uri: config.SLACK_REDIRECT_URI,
      });

      if (!response.ok || !response.access_token) {
        throw new Error(response.error || 'Failed to exchange Slack OAuth code');
      }

      const teamId = response.team?.id || 'unknown_team';
      const teamName = response.team?.name || 'Slack Workspace';
      const encryptedToken = encrypt(response.access_token as string);
      const incomingWebhook = (response as any).incoming_webhook;

      const integration = await prisma.slackIntegration.upsert({
        where: { userId },
        update: {
          teamId,
          teamName,
          accessToken: encryptedToken,
          channelId: incomingWebhook?.channel_id || null,
          channelName: incomingWebhook?.channel || null,
          updatedAt: new Date(),
        },
        create: {
          userId,
          teamId,
          teamName,
          accessToken: encryptedToken,
          channelId: incomingWebhook?.channel_id || null,
          channelName: incomingWebhook?.channel || null,
        },
      });

      logger.info(`Slack connected successfully for user ${userId} in team ${teamName}`);
      return integration;
    } catch (err: any) {
      logger.error(`Slack OAuth exchange failed: ${err.message}`);
      throw err;
    }
  }

  /**
   * Send rate-limit alert message to user's Slack workspace
   */
  public static async sendRateLimitAlert(params: {
    userId: string;
    senderEmail: string;
    hourlyLimit: number;
    hourWindow: string;
  }): Promise<boolean> {
    try {
      const integration = await prisma.slackIntegration.findUnique({
        where: { userId: params.userId },
      });

      if (!integration || !integration.accessToken) {
        logger.debug(`User ${params.userId} has not connected Slack. Skipping Slack alert.`);
        return false;
      }

      const token = decrypt(integration.accessToken);
      if (!token) {
        logger.warn(`Could not decrypt Slack token for user ${params.userId}`);
        return false;
      }

      const client = new WebClient(token);

      // Determine destination channel (or default general/random or user direct message)
      let targetChannel = integration.channelId;
      if (!targetChannel) {
        // List public channels to find a suitable destination
        const list = await client.conversations.list({ types: 'public_channel', limit: 10 });
        const general = list.channels?.find((c) => c.name === 'general' || c.is_general) || list.channels?.[0];
        targetChannel = general?.id;
      }

      if (!targetChannel) {
        logger.warn(`No Slack channel found to post rate limit alert for user ${params.userId}`);
        return false;
      }

      const message = `⚠️ *Email Rate Limit Reached*\n*Sender:* ${params.senderEmail}\n*Hourly limit:* ${params.hourlyLimit} emails\n*Window:* ${params.hourWindow}\nThe remaining scheduled emails have been moved to the next available hour window.`;

      await client.chat.postMessage({
        channel: targetChannel,
        text: message,
        blocks: [
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `⚠️ *Email Rate Limit Reached*`,
            },
          },
          {
            type: 'section',
            fields: [
              { type: 'mrkdwn', text: `*Sender:*\n${params.senderEmail}` },
              { type: 'mrkdwn', text: `*Hourly Limit:*\n${params.hourlyLimit} emails` },
              { type: 'mrkdwn', text: `*Window:*\n${params.hourWindow}` },
              { type: 'mrkdwn', text: `*Action:*\nRescheduled to next hour` },
            ],
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Sent automatically by ReachInbox Job Scheduler',
              },
            ],
          },
        ],
      });

      logger.info(`Slack rate limit notification posted successfully to channel ${targetChannel}`);
      return true;
    } catch (err: any) {
      logger.warn(`Failed to send Slack rate limit alert: ${err.message}`);
      return false;
    }
  }
}
