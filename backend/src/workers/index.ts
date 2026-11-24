import { createEmailWorker } from './emailWorker.js';
import { reconcileJobs } from '../schedulers/reconciliation.js';
import { initElasticsearch } from '../integrations/elasticsearch/index.js';
import { logger } from '../utils/logger.js';
import prisma from '../config/prisma.js';
import { redisConnection } from '../config/redis.js';

logger.info('Initializing Background Worker Process...');

async function startWorker() {
  try {
    // 1. Initialize Elasticsearch
    await initElasticsearch();

    // 2. Perform restart reconciliation
    await reconcileJobs();

    // 3. Start BullMQ worker
    const worker = createEmailWorker();
    logger.info('Background Email Worker running and listening for jobs.');

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down worker gracefully...`);
      await worker.close();
      await prisma.$disconnect();
      redisConnection.disconnect();
      process.exit(0);
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err: any) {
    logger.error(`Worker startup failed: ${err.message}`);
    process.exit(1);
  }
}

startWorker();
