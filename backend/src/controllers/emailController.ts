import { Request, Response } from 'express';
import { scheduleEmailSchema } from '../validators/index.js';
import { EmailScheduler } from '../schedulers/emailScheduler.js';
import prisma from '../config/prisma.js';
import { searchEmails } from '../integrations/elasticsearch/index.js';

export class EmailController {
  public static async schedule(req: Request, res: Response) {
    const parseResult = scheduleEmailSchema.safeParse(req.body);
    if (!parseResult.success) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        details: parseResult.error.errors,
      });
    }

    const data = parseResult.data;
    try {
      const scheduleResult = await EmailScheduler.scheduleEmails({
        userId: req.user!.id,
        senderId: data.senderId,
        subject: data.subject,
        body: data.body,
        recipients: data.recipients,
        startTime: new Date(data.startTime),
        delayBetweenEmails: data.delayBetweenEmails,
        hourlyLimit: data.hourlyLimit,
      });

      return res.status(201).json({
        success: true,
        message: 'Emails scheduled successfully',
        data: scheduleResult,
      });
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        error: err.message,
      });
    }
  }

  public static async getScheduled(req: Request, res: Response) {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          userId: req.user!.id,
          status: { in: ['scheduled', 'processing'] },
        },
        include: {
          sender: { select: { id: true, senderName: true, senderEmail: true } },
        },
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: {
          userId: req.user!.id,
          status: { in: ['scheduled', 'processing'] },
        },
      }),
    ]);

    return res.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  public static async getSent(req: Request, res: Response) {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const status = req.query.status as string; // 'sent', 'failed', or all
    const skip = (page - 1) * limit;

    const statusFilter = status && status !== 'all' ? status as any : { in: ['sent', 'failed'] };

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: {
          userId: req.user!.id,
          status: statusFilter,
        },
        include: {
          sender: { select: { id: true, senderName: true, senderEmail: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailJob.count({
        where: {
          userId: req.user!.id,
          status: statusFilter,
        },
      }),
    ]);

    return res.json({
      success: true,
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  public static async getById(req: Request, res: Response) {
    const { id } = req.params;
    const email = await prisma.emailJob.findFirst({
      where: { id, userId: req.user!.id },
      include: {
        sender: { select: { id: true, senderName: true, senderEmail: true } },
      },
    });

    if (!email) {
      return res.status(404).json({ success: false, error: 'Email record not found' });
    }

    return res.json({ success: true, email });
  }

  public static async cancel(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const cancelled = await EmailScheduler.cancelJob(id, req.user!.id);
      if (!cancelled) {
        return res.status(404).json({ success: false, error: 'Email job not found' });
      }
      return res.json({ success: true, message: 'Email job cancelled successfully' });
    } catch (err: any) {
      return res.status(400).json({ success: false, error: err.message });
    }
  }

  public static async search(req: Request, res: Response) {
    const q = (req.query.q as string) || '';
    const status = (req.query.status as string) || '';
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;

    // 1. Try Elasticsearch first
    const esResult = await searchEmails({
      userId: req.user!.id,
      q,
      status,
      page,
      limit,
    });

    if (esResult) {
      return res.json({
        success: true,
        source: 'elasticsearch',
        items: esResult.hits,
        pagination: {
          page,
          limit,
          total: esResult.total,
          totalPages: Math.ceil(esResult.total / limit),
        },
      });
    }

    // 2. Fallback to PostgreSQL search
    const whereClause: any = { userId: req.user!.id };
    if (status && status !== 'all') {
      whereClause.status = status;
    }
    if (q.trim()) {
      whereClause.OR = [
        { recipientEmail: { contains: q, mode: 'insensitive' } },
        { subject: { contains: q, mode: 'insensitive' } },
        { body: { contains: q, mode: 'insensitive' } },
      ];
    }

    const [items, total] = await Promise.all([
      prisma.emailJob.findMany({
        where: whereClause,
        include: { sender: { select: { id: true, senderName: true, senderEmail: true } } },
        orderBy: { scheduledAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.emailJob.count({ where: whereClause }),
    ]);

    return res.json({
      success: true,
      source: 'postgres_fallback',
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  }

  public static async getStats(req: Request, res: Response) {
    const userId = req.user!.id;

    const [scheduledCount, processingCount, sentCount, failedCount, cancelledCount] = await Promise.all([
      prisma.emailJob.count({ where: { userId, status: 'scheduled' } }),
      prisma.emailJob.count({ where: { userId, status: 'processing' } }),
      prisma.emailJob.count({ where: { userId, status: 'sent' } }),
      prisma.emailJob.count({ where: { userId, status: 'failed' } }),
      prisma.emailJob.count({ where: { userId, status: 'cancelled' } }),
    ]);

    return res.json({
      success: true,
      stats: {
        scheduled: scheduledCount,
        processing: processingCount,
        sent: sentCount,
        failed: failedCount,
        cancelled: cancelledCount,
        total: scheduledCount + processingCount + sentCount + failedCount + cancelledCount,
      },
    });
  }
}
