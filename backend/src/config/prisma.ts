import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger.js';

const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});

prisma.$connect()
  .then(() => logger.info('PostgreSQL connected via Prisma'))
  .catch((err) => logger.warn(`Prisma connect attempt failed: ${err.message}`));

export default prisma;
