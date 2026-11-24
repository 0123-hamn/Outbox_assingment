import { Request, Response } from 'express';
import { emailQueue } from '../queues/emailQueue.js';

export class QueueController {
  public static async getStats(req: Request, res: Response) {
    try {
      const [waiting, active, delayed, completed, failed] = await Promise.all([
        emailQueue.getWaitingCount(),
        emailQueue.getActiveCount(),
        emailQueue.getDelayedCount(),
        emailQueue.getCompletedCount(),
        emailQueue.getFailedCount(),
      ]);

      return res.json({
        success: true,
        stats: {
          waiting,
          active,
          delayed,
          completed,
          failed,
          total: waiting + active + delayed + completed + failed,
        },
      });
    } catch (err: any) {
      return res.status(500).json({ success: false, error: err.message });
    }
  }
}
