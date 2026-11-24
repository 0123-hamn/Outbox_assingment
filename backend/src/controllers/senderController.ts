import { Request, Response } from 'express';
import { createSenderSchema, updateSenderSchema } from '../validators/index.js';
import { encrypt } from '../utils/crypto.js';
import prisma from '../config/prisma.js';

export class SenderController {
  public static async list(req: Request, res: Response) {
    const senders = await prisma.emailSender.findMany({
      where: { userId: req.user!.id },
      select: {
        id: true,
        senderName: true,
        senderEmail: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return res.json({ success: true, senders });
  }

  public static async create(req: Request, res: Response) {
    const parse = createSenderSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors });
    }

    const { senderName, senderEmail, host, port, secure, user, pass } = parse.data;

    let smtpConfigEnc: string | null = null;
    if (host && port) {
      smtpConfigEnc = encrypt(JSON.stringify({ host, port, secure, user, pass }));
    }

    const sender = await prisma.emailSender.create({
      data: {
        userId: req.user!.id,
        senderName,
        senderEmail,
        smtpConfigEnc,
        isActive: true,
      },
      select: {
        id: true,
        senderName: true,
        senderEmail: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.status(201).json({ success: true, sender });
  }

  public static async update(req: Request, res: Response) {
    const { id } = req.params;
    const parse = updateSenderSchema.safeParse(req.body);
    if (!parse.success) {
      return res.status(400).json({ success: false, error: parse.error.errors });
    }

    const existing = await prisma.emailSender.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Sender not found' });
    }

    const { senderName, senderEmail, isActive, host, port, secure, user, pass } = parse.data;
    const updateData: any = {};
    if (senderName !== undefined) updateData.senderName = senderName;
    if (senderEmail !== undefined) updateData.senderEmail = senderEmail;
    if (isActive !== undefined) updateData.isActive = isActive;

    if (host && port) {
      updateData.smtpConfigEnc = encrypt(JSON.stringify({ host, port, secure, user, pass }));
    }

    const updated = await prisma.emailSender.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        senderName: true,
        senderEmail: true,
        isActive: true,
        createdAt: true,
      },
    });

    return res.json({ success: true, sender: updated });
  }

  public static async delete(req: Request, res: Response) {
    const { id } = req.params;
    const existing = await prisma.emailSender.findFirst({
      where: { id, userId: req.user!.id },
    });

    if (!existing) {
      return res.status(404).json({ success: false, error: 'Sender not found' });
    }

    await prisma.emailSender.delete({ where: { id } });
    return res.json({ success: true, message: 'Sender deleted successfully' });
  }
}
