import { app } from './app.js';
import { config } from './config/index.js';
import { logger } from './utils/logger.js';
import { initElasticsearch } from './integrations/elasticsearch/index.js';
import { reconcileJobs } from './schedulers/reconciliation.js';
import prisma from './config/prisma.js';
import { redisConnection } from './config/redis.js';

async function bootstrap() {
  try {
    // 1. Initialize Elasticsearch (with fallback)
    await initElasticsearch();

    // 2. Run startup reconciliation check
    await reconcileJobs();

    // 3. Start HTTP server
    const server = app.listen(config.PORT, () => {
      logger.info(`ReachInbox Backend API server running on port ${config.PORT}`);
      logger.info(`Bull Board queue dashboard available at http://localhost:${config.PORT}/admin/queues`);
    });

    // Graceful shutdown
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal}. Shutting down API server gracefully...`);
      server.close(async () => {
        logger.info('HTTP server closed. Disconnecting database and Redis...');
        await prisma.$disconnect();
        redisConnection.disconnect();
        process.exit(0);
      });
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
  } catch (err: any) {
    logger.error(`Server startup failed: ${err.message}`);
    process.exit(1);
  }
}

bootstrap();
