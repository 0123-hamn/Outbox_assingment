import { Redis } from 'ioredis';
import { config } from './index.js';
import { logger } from '../utils/logger.js';

export const redisConnection = new Redis(config.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    const delay = Math.min(times * 100, 3000);
    return delay;
  },
});

redisConnection.on('connect', () => {
  logger.info('Connected to Redis');
});

redisConnection.on('error', (err) => {
  logger.warn(`Redis connection error: ${err.message}`);
});
