import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { app } from '../src/app.js';
import { scheduleEmailSchema } from '../src/validators/index.js';
import { DistributedRateLimiter } from '../src/schedulers/rateLimiter.js';

describe('Validation Schemas', () => {
  it('validates a valid email scheduling request payload', () => {
    const validPayload = {
      subject: 'Interview Invitation',
      body: 'Hello candidate, welcome to our interview process.',
      recipients: ['alex@example.com', 'maria@example.com'],
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: '2026-11-25T10:00:00.000Z',
      delayBetweenEmails: 2000,
      hourlyLimit: 200,
    };

    const result = scheduleEmailSchema.safeParse(validPayload);
    expect(result.success).toBe(true);
  });

  it('rejects invalid email recipients', () => {
    const invalidPayload = {
      subject: 'Test',
      body: 'Hello',
      recipients: ['not-an-email'],
      senderId: '123e4567-e89b-12d3-a456-426614174000',
      startTime: '2026-11-25T10:00:00.000Z',
      delayBetweenEmails: 2000,
      hourlyLimit: 200,
    };

    const result = scheduleEmailSchema.safeParse(invalidPayload);
    expect(result.success).toBe(false);
  });
});

describe('Rate Limiter Windows & Helper Calculation', () => {
  it('generates consistent UTC hour window keys', () => {
    const fixedDate = new Date('2026-11-25T14:35:00.000Z');
    const windowKey = DistributedRateLimiter.getHourWindow(fixedDate);
    expect(windowKey).toBe('2026-11-25T14');
  });

  it('calculates remaining milliseconds until next hour', () => {
    const fixedDate = new Date('2026-11-25T14:30:00.000Z');
    const msLeft = DistributedRateLimiter.getMsUntilNextHour(fixedDate);
    // 30 minutes in ms = 1,800,000 ms
    expect(msLeft).toBe(1800000);
  });
});

describe('Public Endpoints', () => {
  it('responds to health check endpoint', async () => {
    const res = await request(app).get('/api/health');
    expect([200, 503]).toContain(res.status);
    expect(res.body).toHaveProperty('services');
  });
});
