import { redisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';
import prisma from '../config/prisma.js';
import { SlackService } from '../integrations/slack/index.js';

export interface IRateLimitReservation {
  allowed: boolean;
  currentCount: number;
  limit: number;
  hourWindow: string;
  msUntilNextHour: number;
}

/**
 * Distributed rate limiter backed by Redis atomic operations.
 * Key format: "ratelimit:sender:{senderId}:{YYYY-MM-DDTHH}"
 */
export class DistributedRateLimiter {
  /**
   * Get the current hour window string, e.g. "2026-11-25T10"
   */
  public static getHourWindow(date: Date = new Date()): string {
    const yyyy = date.getUTCFullYear();
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const hh = String(date.getUTCHours()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}T${hh}`;
  }

  /**
   * Calculate milliseconds remaining until the start of the next hour window
   */
  public static getMsUntilNextHour(date: Date = new Date()): number {
    const nextHour = new Date(date);
    nextHour.setUTCHours(nextHour.getUTCHours() + 1, 0, 0, 0);
    return Math.max(1000, nextHour.getTime() - date.getTime());
  }

  /**
   * Atomically reserve an email quota slot for a sender in the current hour window.
   * If limit is reached, returns allowed: false and msUntilNextHour.
   */
  public static async reserveSenderQuota(
    senderId: string,
    userId: string,
    senderEmail: string,
    limit: number
  ): Promise<IRateLimitReservation> {
    const now = new Date();
    const hourWindow = this.getHourWindow(now);
    const redisKey = `ratelimit:sender:${senderId}:${hourWindow}`;
    const msUntilNextHour = this.getMsUntilNextHour(now);

    // Redis Lua Script to atomically check and increment only if within limit
    const luaScript = `
      local current = redis.call('GET', KEYS[1])
      if current and tonumber(current) >= tonumber(ARGV[1]) then
        return {0, tonumber(current)}
      else
        local newVal = redis.call('INCR', KEYS[1])
        if newVal == 1 then
          redis.call('EXPIRE', KEYS[1], ARGV[2])
        end
        return {1, newVal}
      end
    `;

    try {
      // 2 hours expiry in seconds to ensure cleanup
      const ttlSeconds = Math.ceil(msUntilNextHour / 1000) + 3600;
      const result = (await redisConnection.eval(luaScript, 1, redisKey, limit, ttlSeconds)) as [number, number];

      const allowed = result[0] === 1;
      const currentCount = result[1];

      if (!allowed) {
        // Limit reached! Record rate-limit event and trigger Slack notification once per window
        await this.handleRateLimitExceeded(senderId, userId, senderEmail, limit, hourWindow, currentCount);
      }

      return {
        allowed,
        currentCount,
        limit,
        hourWindow,
        msUntilNextHour,
      };
    } catch (err: any) {
      logger.error(`Redis rate limit evaluation error: ${err.message}`);
      // Fail-open or fallback to DB count check
      return {
        allowed: true,
        currentCount: 0,
        limit,
        hourWindow,
        msUntilNextHour,
      };
    }
  }

  /**
   * Enforce minimum delay between email sends for a given sender using Redis lock/last-sent timestamp.
   */
  public static async enforceMinDelay(senderId: string, minDelayMs: number): Promise<void> {
    if (minDelayMs <= 0) return;
    const lastSentKey = `lastsent:sender:${senderId}`;
    const now = Date.now();

    try {
      const lastSentStr = await redisConnection.get(lastSentKey);
      if (lastSentStr) {
        const lastSent = parseInt(lastSentStr, 10);
        const timePassed = now - lastSent;
        if (timePassed < minDelayMs) {
          const waitTime = minDelayMs - timePassed;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
      await redisConnection.set(lastSentKey, Date.now().toString(), 'PX', minDelayMs * 5);
    } catch (err: any) {
      logger.warn(`Min delay enforcement failed: ${err.message}`);
    }
  }

  /**
   * Handle when a sender hits the hourly limit: record RateLimitEvent and trigger Slack notification
   */
  private static async handleRateLimitExceeded(
    senderId: string,
    userId: string,
    senderEmail: string,
    limit: number,
    hourWindow: string,
    currentCount: number
  ): Promise<void> {
    try {
      // Ensure idempotency for notifications: check if already notified in this window
      const eventKey = `notified:sender:${senderId}:${hourWindow}`;
      const alreadyNotified = await redisConnection.set(eventKey, '1', 'EX', 7200, 'NX');

      if (alreadyNotified === 'OK') {
        logger.warn(`Sender ${senderEmail} exceeded hourly limit of ${limit} in window ${hourWindow}. Triggering notification.`);

        // Store RateLimitEvent in PostgreSQL
        await prisma.rateLimitEvent.upsert({
          where: {
            senderId_hourWindow: {
              senderId,
              hourWindow,
            },
          },
          update: {
            currentCount,
            notifiedAt: new Date(),
          },
          create: {
            userId,
            senderId,
            hourWindow,
            limitValue: limit,
            currentCount,
            notifiedAt: new Date(),
          },
        });

        // Trigger Slack notification
        await SlackService.sendRateLimitAlert({
          userId,
          senderEmail,
          hourlyLimit: limit,
          hourWindow,
        });
      }
    } catch (err: any) {
      logger.error(`Error in handleRateLimitExceeded: ${err.message}`);
    }
  }
}
