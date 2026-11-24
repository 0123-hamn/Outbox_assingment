import { Worker, Job } from 'bullmq';
import { redisConnection } from '../config/redis.js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';
import { EMAIL_QUEUE_NAME, IEmailJobData, emailQueue } from '../queues/emailQueue.js';
import prisma from '../config/prisma.js';
import { DistributedRateLimiter } from '../schedulers/rateLimiter.js';
import { EmailService } from '../integrations/email/index.js';
import { indexEmail } from '../integrations/elasticsearch/index.js';

export async function processEmailJob(job: Job<IEmailJobData>): Promise<void> {
  const data = job.data;
  logger.info(`[Worker] Received job ${job.id} for recipient ${data.recipientEmail}`);

  // 1. Verify DB record state with atomic lease
  // Only process if status is 'scheduled' or 'processing'
  const record = await prisma.emailJob.findUnique({
    where: { id: data.jobRecordId },
    include: { sender: true },
  });

  if (!record) {
    logger.warn(`Job record ${data.jobRecordId} does not exist in DB. Discarding.`);
    return;
  }

  if (record.status === 'sent' || record.status === 'cancelled') {
    logger.info(`Job record ${data.jobRecordId} has status '${record.status}'. Skipping.`);
    return;
  }

  // Atomically claim the job to prevent concurrent duplicate processing
  const claimed = await prisma.emailJob.updateMany({
    where: {
      id: data.jobRecordId,
      status: { in: ['scheduled', 'failed'] },
    },
    data: {
      status: 'processing',
      attempts: { increment: 1 },
    },
  });

  if (claimed.count === 0 && record.status !== 'processing') {
    logger.warn(`Job ${data.jobRecordId} could not be leased. Another worker might be processing it.`);
    return;
  }

  // 2. Distributed hourly rate limiting check
  const hourlyLimit = data.hourlyLimit || config.MAX_EMAILS_PER_HOUR_PER_SENDER;
  const quota = await DistributedRateLimiter.reserveSenderQuota(
    data.senderId,
    data.userId,
    data.senderEmail,
    hourlyLimit
  );

  if (!quota.allowed) {
    logger.warn(
      `Hourly rate limit reached for sender ${data.senderEmail} (${quota.currentCount}/${quota.limit}). Rescheduling job ${job.id} to next hour in ${Math.round(quota.msUntilNextHour / 1000)}s`
    );

    // Rollback record status back to scheduled
    const nextExecutionTime = new Date(Date.now() + quota.msUntilNextHour);
    await prisma.emailJob.update({
      where: { id: data.jobRecordId },
      data: {
        status: 'scheduled',
        scheduledAt: nextExecutionTime,
      },
    });

    // Reschedule in BullMQ as delayed job for next hour
    const newBullJobId = `email_${data.jobRecordId}_rescheduled_${Date.now()}`;
    await emailQueue.add('send-email', data, {
      jobId: newBullJobId,
      delay: quota.msUntilNextHour,
      attempts: 5,
      backoff: {
        type: 'exponential',
        delay: 5000,
      },
    });

    // Update DB with new BullMQ Job ID
    await prisma.emailJob.update({
      where: { id: data.jobRecordId },
      data: { bullJobId: newBullJobId },
    });

    return;
  }

  // 3. Minimum delay between email sends
  const minDelayMs = data.delayBetweenEmails || config.MIN_DELAY_BETWEEN_EMAILS_MS;
  await DistributedRateLimiter.enforceMinDelay(data.senderId, minDelayMs);

  // 4. Send email via Nodemailer (Ethereal)
  const deliveryResult = await EmailService.sendMail({
    fromName: data.senderName,
    fromEmail: data.senderEmail,
    to: data.recipientEmail,
    subject: data.subject,
    body: data.body,
    smtpConfigEnc: record.sender.smtpConfigEnc,
  });

  if (deliveryResult.success) {
    const sentAt = new Date();
    const updatedRecord = await prisma.emailJob.update({
      where: { id: data.jobRecordId },
      data: {
        status: 'sent',
        sentAt,
        messageId: deliveryResult.messageId || null,
        previewUrl: typeof deliveryResult.previewUrl === 'string' ? deliveryResult.previewUrl : null,
        lastError: null,
      },
    });

    // 5. Index updated record in Elasticsearch
    await indexEmail({
      id: updatedRecord.id,
      userId: updatedRecord.userId,
      senderId: updatedRecord.senderId,
      senderEmail: data.senderEmail,
      recipientEmail: updatedRecord.recipientEmail,
      subject: updatedRecord.subject,
      body: updatedRecord.body,
      status: updatedRecord.status,
      scheduledAt: updatedRecord.scheduledAt,
      sentAt: updatedRecord.sentAt,
      createdAt: updatedRecord.createdAt,
    });

    logger.info(`Successfully processed email ${data.jobRecordId} to ${data.recipientEmail}`);
  } else {
    // Delivery failed
    await prisma.emailJob.update({
      where: { id: data.jobRecordId },
      data: {
        status: 'failed',
        lastError: deliveryResult.error || 'SMTP delivery failed',
      },
    });
    throw new Error(deliveryResult.error || 'SMTP delivery failed');
  }
}

export function createEmailWorker(): Worker {
  const concurrency = config.WORKER_CONCURRENCY || 5;

  const worker = new Worker(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: redisConnection,
    concurrency,
    limiter: {
      max: 100,
      duration: 1000,
    },
  });

  worker.on('completed', (job) => {
    logger.info(`Worker finished job ${job.id}`);
  });

  worker.on('failed', (job, err) => {
    logger.error(`Worker failed job ${job?.id}: ${err.message}`);
  });

  worker.on('error', (err) => {
    logger.error(`BullMQ Worker internal error: ${err.message}`);
  });

  return worker;
}
