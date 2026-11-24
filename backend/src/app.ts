import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter.js';
import { ExpressAdapter } from '@bull-board/express';
import { config } from './config/index.js';
import { emailQueue } from './queues/emailQueue.js';
import authRoutes from './routes/authRoutes.js';
import emailRoutes from './routes/emailRoutes.js';
import senderRoutes from './routes/senderRoutes.js';
import slackRoutes from './routes/slackRoutes.js';
import queueRoutes from './routes/queueRoutes.js';
import { authMiddleware } from './middlewares/auth.js';
import { logger } from './utils/logger.js';
import prisma from './config/prisma.js';
import { redisConnection } from './config/redis.js';
import { isElasticsearchReady } from './integrations/elasticsearch/index.js';

export const app = express();

// Security and middleware
app.use(helmet({
  contentSecurityPolicy: false, // Allow Bull Board UI
}));
app.use(
  cors({
    origin: config.FRONTEND_URL,
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health Check API
app.get('/api/health', async (req: Request, res: Response) => {
  let dbHealthy = false;
  let redisHealthy = false;

  try {
    await prisma.$queryRaw`SELECT 1`;
    dbHealthy = true;
  } catch (e) {
    dbHealthy = false;
  }

  try {
    await redisConnection.ping();
    redisHealthy = true;
  } catch (e) {
    redisHealthy = false;
  }

  const esHealthy = isElasticsearchReady();
  const overallHealthy = dbHealthy && redisHealthy;

  return res.status(overallHealthy ? 200 : 503).json({
    status: overallHealthy ? 'healthy' : 'degraded',
    timestamp: new Date().toISOString(),
    services: {
      database: dbHealthy ? 'up' : 'down',
      redis: redisHealthy ? 'up' : 'down',
      elasticsearch: esHealthy ? 'up' : 'down_or_offline',
    },
  });
});

// Bull Board Admin UI
const serverAdapter = new ExpressAdapter();
serverAdapter.setBasePath('/admin/queues');

createBullBoard({
  queues: [new BullMQAdapter(emailQueue)],
  serverAdapter,
});

// Protect /admin/queues in production
if (config.NODE_ENV === 'production') {
  app.use('/admin/queues', authMiddleware, serverAdapter.getRouter());
} else {
  app.use('/admin/queues', serverAdapter.getRouter());
}

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/emails', emailRoutes);
app.use('/api/senders', senderRoutes);
app.use('/api/slack', slackRoutes);
app.use('/api/queue', queueRoutes);

// Centralized error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(`Unhandled error: ${err.message}`, { stack: err.stack });
  const statusCode = err.status || 500;
  return res.status(statusCode).json({
    success: false,
    error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});
