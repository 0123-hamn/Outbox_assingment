import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { logger } from '../utils/logger.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface IEmailJobData {
  jobRecordId: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  senderName: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string; // ISO string
  hourlyLimit?: number;
  delayBetweenEmails?: number;
  batchId?: string;
  attempt?: number;
}

export const emailQueue = new Queue<IEmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 5,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      age: 24 * 3600, // Keep completed jobs for 24h
      count: 10000,
    },
    removeOnFail: {
      age: 7 * 24 * 3600, // Keep failed jobs for 7 days
    },
  },
});

emailQueue.on('error', (err) => {
  logger.error(`BullMQ Queue Error: ${err.message}`);
});
