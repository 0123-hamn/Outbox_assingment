import { z } from 'zod';

export const scheduleEmailSchema = z.object({
  subject: z.string().min(1, 'Subject is required').max(255),
  body: z.string().min(1, 'Email body is required'),
  recipients: z
    .array(z.string().email('Invalid email address'))
    .min(1, 'At least one recipient is required')
    .max(5000, 'Maximum 5000 recipients allowed per schedule request'),
  senderId: z.string().uuid('Invalid sender ID format'),
  startTime: z.string().datetime({ message: 'Invalid ISO start time string' }),
  delayBetweenEmails: z.number().int().min(0).default(2000),
  hourlyLimit: z.number().int().min(1).max(5000).default(200),
});

export const createSenderSchema = z.object({
  senderName: z.string().min(1, 'Sender name is required'),
  senderEmail: z.string().email('Invalid sender email address'),
  host: z.string().optional(),
  port: z.number().int().optional(),
  secure: z.boolean().optional(),
  user: z.string().optional(),
  pass: z.string().optional(),
});

export const updateSenderSchema = z.object({
  senderName: z.string().optional(),
  senderEmail: z.string().email().optional(),
  isActive: z.boolean().optional(),
  host: z.string().optional(),
  port: z.number().int().optional(),
  secure: z.boolean().optional(),
  user: z.string().optional(),
  pass: z.string().optional(),
});
