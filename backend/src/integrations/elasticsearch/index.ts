import { Client } from '@elastic/elasticsearch';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export const EMAIL_INDEX = 'reachinbox_emails';

let esClient: Client | null = null;
let isEsAvailable = false;

try {
  esClient = new Client({
    node: config.ELASTICSEARCH_URL,
    maxRetries: 3,
    requestTimeout: 3000,
  });
} catch (err: any) {
  logger.warn(`Elasticsearch client initialization failed: ${err.message}`);
}

export async function initElasticsearch(): Promise<void> {
  if (!esClient) return;
  try {
    const health = await esClient.cluster.health();
    isEsAvailable = true;
    logger.info(`Elasticsearch connected with status: ${health.status}`);

    const indexExists = await esClient.indices.exists({ index: EMAIL_INDEX });
    if (!indexExists) {
      await esClient.indices.create({
        index: EMAIL_INDEX,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              userId: { type: 'keyword' },
              senderId: { type: 'keyword' },
              senderEmail: { type: 'keyword' },
              recipientEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledAt: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
            },
          },
        },
      });
      logger.info(`Elasticsearch index '${EMAIL_INDEX}' created successfully`);
    }
  } catch (err: any) {
    isEsAvailable = false;
    logger.warn(`Elasticsearch unavailable or unreachable: ${err.message}. Gracefully continuing with PostgreSQL fallback.`);
  }
}

export async function indexEmail(email: {
  id: string;
  userId: string;
  senderId: string;
  senderEmail: string;
  recipientEmail: string;
  subject: string;
  body: string;
  status: string;
  scheduledAt: Date;
  sentAt?: Date | null;
  createdAt: Date;
}): Promise<void> {
  if (!esClient || !isEsAvailable) return;
  try {
    await esClient.index({
      index: EMAIL_INDEX,
      id: email.id,
      document: {
        id: email.id,
        userId: email.userId,
        senderId: email.senderId,
        senderEmail: email.senderEmail,
        recipientEmail: email.recipientEmail,
        subject: email.subject,
        body: email.body,
        status: email.status,
        scheduledAt: email.scheduledAt.toISOString(),
        sentAt: email.sentAt ? email.sentAt.toISOString() : null,
        createdAt: email.createdAt.toISOString(),
      },
      refresh: 'wait_for',
    });
  } catch (err: any) {
    logger.warn(`Failed to index email ${email.id} in Elasticsearch: ${err.message}`);
  }
}

export async function searchEmails(params: {
  userId: string;
  q?: string;
  status?: string;
  page?: number;
  limit?: number;
}): Promise<{ hits: any[]; total: number } | null> {
  if (!esClient || !isEsAvailable) return null;
  try {
    const { userId, q, status, page = 1, limit = 20 } = params;
    const must: any[] = [{ term: { userId } }];

    if (status && status !== 'all') {
      must.push({ term: { status } });
    }

    if (q && q.trim()) {
      must.push({
        multi_match: {
          query: q.trim(),
          fields: ['subject^2', 'body', 'recipientEmail', 'senderEmail'],
          fuzziness: 'AUTO',
        },
      });
    }

    const response = await esClient.search({
      index: EMAIL_INDEX,
      from: (page - 1) * limit,
      size: limit,
      query: { bool: { must } },
      sort: [{ scheduledAt: { order: 'desc' } }],
    });

    const total = typeof response.hits.total === 'number' ? response.hits.total : response.hits.total?.value || 0;
    const hits = response.hits.hits.map((h) => h._source);

    return { hits, total };
  } catch (err: any) {
    logger.warn(`Elasticsearch search failed: ${err.message}`);
    return null;
  }
}

export function isElasticsearchReady(): boolean {
  return isEsAvailable;
}
