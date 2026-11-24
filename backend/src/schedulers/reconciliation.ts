import prisma from '../config/prisma.js';
import { emailQueue, IEmailJobData } from '../queues/emailQueue.js';
import { logger } from '../utils/logger.js';

/**
 * Reconciles scheduled jobs in PostgreSQL with BullMQ queue after restarts.
 * Ensures genuine missing jobs are re-queued while maintaining idempotency.
 */
export async function reconcileJobs(): Promise<{ checked: number; recovered: number }> {
  try {
    logger.info('Starting startup job reconciliation between PostgreSQL and BullMQ...');

    // Find all emails that are marked as scheduled or processing (potential crash during processing)
    const pendingEmails = await prisma.emailJob.findMany({
      where: {
        status: { in: ['scheduled', 'processing'] },
      },
      include: {
        sender: true,
      },
      take: 1000,
    });

    let recoveredCount = 0;

    for (const email of pendingEmails) {
      let isJobInQueue = false;

      if (email.bullJobId) {
        const existingJob = await emailQueue.getJob(email.bullJobId);
        if (existingJob) {
          const state = await existingJob.getState();
          if (['delayed', 'waiting', 'active', 'delayed'].includes(state)) {
            isJobInQueue = true;
          }
        }
      }

      // If missing in queue, repair it idempotently!
      if (!isJobInQueue) {
        logger.warn(`Recovering missing BullMQ job for email record ${email.id}`);

        const now = Date.now();
        const targetTime = email.scheduledAt.getTime();
        const delay = Math.max(0, targetTime - now);
        const newBullJobId = `email_${email.id}_recovered_${Date.now()}`;

        const jobData: IEmailJobData = {
          jobRecordId: email.id,
          userId: email.userId,
          senderId: email.senderId,
          senderEmail: email.sender.senderEmail,
          senderName: email.sender.senderName,
          recipientEmail: email.recipientEmail,
          subject: email.subject,
          body: email.body,
          scheduledAt: email.scheduledAt.toISOString(),
        };

        await emailQueue.add('send-email', jobData, {
          jobId: newBullJobId,
          delay,
          attempts: 5,
          backoff: {
            type: 'exponential',
            delay: 5000,
          },
        });

        await prisma.emailJob.update({
          where: { id: email.id },
          data: {
            bullJobId: newBullJobId,
            status: 'scheduled',
          },
        });

        recoveredCount++;
      }
    }

    logger.info(`Reconciliation completed. Checked: ${pendingEmails.length}, Recovered: ${recoveredCount}`);
    return { checked: pendingEmails.length, recovered: recoveredCount };
  } catch (err: any) {
    logger.error(`Job reconciliation error: ${err.message}`);
    return { checked: 0, recovered: 0 };
  }
}
