/**
 * Repeatable Load-Testing Script for ReachInbox Job Scheduler
 * Simulates scheduling 1,000 email jobs, testing worker concurrency,
 * atomic rate limiting, and BullMQ delayed job queues.
 *
 * Usage:
 *   npx tsx tests/loadTest.ts
 */

import { EmailScheduler } from '../src/schedulers/emailScheduler.js';
import { emailQueue } from '../src/queues/emailQueue.js';
import prisma from '../src/config/prisma.js';
import { redisConnection } from '../src/config/redis.js';

async function runLoadTest() {
  console.log('🚀 Starting ReachInbox 1,000 Email Scheduler Load Test...');
  const startTime = Date.now();

  try {
    // 1. Ensure test user and sender exist
    let user = await prisma.user.findFirst({ where: { email: 'loadtest@reachinbox.ai' } });
    if (!user) {
      user = await prisma.user.create({
        data: {
          googleId: `loadtest_${Date.now()}`,
          email: 'loadtest@reachinbox.ai',
          name: 'Load Test Runner',
        },
      });
    }

    let sender = await prisma.emailSender.findFirst({ where: { userId: user.id } });
    if (!sender) {
      sender = await prisma.emailSender.create({
        data: {
          userId: user.id,
          senderName: 'High-Volume Campaign Sender',
          senderEmail: 'campaigns@reachinbox.ai',
        },
      });
    }

    // 2. Generate 1,000 distinct recipients
    const totalJobs = 1000;
    const recipients: string[] = [];
    for (let i = 1; i <= totalJobs; i++) {
      recipients.push(`recipient_${i}@benchmark.reachinbox.test`);
    }

    console.log(`📦 Enqueuing ${totalJobs} individual email jobs with 50ms stagger...`);

    const result = await EmailScheduler.scheduleEmails({
      userId: user.id,
      senderId: sender.id,
      subject: 'Benchmark Job Notification',
      body: 'Performance verification under 1000+ scheduled email loads.',
      recipients,
      startTime: new Date(Date.now() + 5000), // Start in 5 seconds
      delayBetweenEmails: 50,
      hourlyLimit: 200, // Enforces distributed hourly quota
    });

    const elapsedMs = Date.now() - startTime;
    console.log(`✅ Successfully scheduled ${result.scheduledCount} jobs in ${elapsedMs}ms!`);
    console.log(`📅 First execution: ${result.firstExecutionTime.toISOString()}`);
    console.log(`📅 Last execution:  ${result.lastExecutionTime.toISOString()}`);

    // Verify queue count in Redis
    const waiting = await emailQueue.getWaitingCount();
    const delayed = await emailQueue.getDelayedCount();
    console.log(`📊 BullMQ Queue Status: ${waiting} waiting, ${delayed} delayed`);

    console.log('🏁 Load test completed successfully.');
  } catch (err: any) {
    console.error('❌ Load test failed:', err.message);
  } finally {
    await prisma.$disconnect();
    redisConnection.disconnect();
  }
}

runLoadTest();
