import { emailQueue, IEmailJobData } from '../queues/emailQueue.js';
import prisma from '../config/prisma.js';
import { logger } from '../utils/logger.js';

export interface IScheduleEmailInput {
  userId: string;
  senderId: string;
  subject: string;
  body: string;
  recipients: string[];
  startTime: Date;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export interface IScheduleBatchResult {
  batchId: string;
  totalRecipients: number;
  scheduledCount: number;
  firstExecutionTime: Date;
  lastExecutionTime: Date;
  jobs: Array<{
    jobRecordId: string;
    bullJobId: string;
    recipientEmail: string;
    scheduledAt: Date;
  }>;
}

export class EmailScheduler {
  /**
   * Schedule a batch of individual email jobs with staggered delays and deterministic IDs.
   */
  public static async scheduleEmails(input: IScheduleEmailInput): Promise<IScheduleBatchResult> {
    const {
      userId,
      senderId,
      subject,
      body,
      recipients,
      startTime,
      delayBetweenEmails,
      hourlyLimit,
    } = input;

    // Verify sender belongs to authenticated user
    const sender = await prisma.emailSender.findFirst({
      where: { id: senderId, userId },
    });

    if (!sender) {
      throw new Error('Sender not found or does not belong to the user');
    }

    const batchId = `batch_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const results: Array<{
      jobRecordId: string;
      bullJobId: string;
      recipientEmail: string;
      scheduledAt: Date;
    }> = [];

    const now = Date.now();
    const baseStartTime = Math.max(now, startTime.getTime());

    for (let i = 0; i < recipients.length; i++) {
      const recipientEmail = recipients[i].trim().toLowerCase();
      const targetExecutionTime = new Date(baseStartTime + i * delayBetweenEmails);
      const delayMs = Math.max(0, targetExecutionTime.getTime() - Date.now());

      // Create persistent DB record first
      const emailRecord = await prisma.emailJob.create({
        data: {
          userId,
          senderId,
          recipientEmail,
          subject,
          body,
          scheduledAt: targetExecutionTime,
          status: 'scheduled',
          attempts: 0,
        },
      });

      // Generate deterministic BullMQ job ID
      const bullJobId = `email_${emailRecord.id}`;

      // Schedule delayed job in BullMQ
      const jobData: IEmailJobData = {
        jobRecordId: emailRecord.id,
        userId,
        senderId,
        senderEmail: sender.senderEmail,
        senderName: sender.senderName,
        recipientEmail,
        subject,
        body,
        scheduledAt: targetExecutionTime.toISOString(),
        hourlyLimit,
        delayBetweenEmails,
        batchId,
      };

      await emailQueue.add('send-email', jobData, {
        jobId: bullJobId,
        delay: delayMs,
        attempts: 5,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      });

      // Update record with BullMQ job ID
      await prisma.emailJob.update({
        where: { id: emailRecord.id },
        data: { bullJobId },
      });

      results.push({
        jobRecordId: emailRecord.id,
        bullJobId,
        recipientEmail,
        scheduledAt: targetExecutionTime,
      });
    }

    logger.info(`Scheduled ${results.length} email jobs for batch ${batchId}`);

    return {
      batchId,
      totalRecipients: recipients.length,
      scheduledCount: results.length,
      firstExecutionTime: new Date(baseStartTime),
      lastExecutionTime: new Date(baseStartTime + (recipients.length - 1) * delayBetweenEmails),
      jobs: results,
    };
  }

  /**
   * Cancel a scheduled email job
   */
  public static async cancelJob(jobRecordId: string, userId: string): Promise<boolean> {
    const jobRecord = await prisma.emailJob.findFirst({
      where: { id: jobRecordId, userId },
    });

    if (!jobRecord) return false;
    if (jobRecord.status !== 'scheduled') {
      throw new Error(`Cannot cancel job in '${jobRecord.status}' status`);
    }

    if (jobRecord.bullJobId) {
      const bullJob = await emailQueue.getJob(jobRecord.bullJobId);
      if (bullJob) {
        await bullJob.remove();
      }
    }

    await prisma.emailJob.update({
      where: { id: jobRecordId },
      data: { status: 'cancelled' },
    });

    return true;
  }
}
