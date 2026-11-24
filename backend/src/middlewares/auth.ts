import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import prisma from '../config/prisma.js';

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

export function generateJwtToken(user: AuthenticatedUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, avatar: user.avatar },
    config.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function authMiddleware(req: Request, res: Response, next: NextFunction) {
  try {
    let token = req.cookies?.reachinbox_token;

    // Check Bearer header as alternative
    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Authentication token missing' });
    }

    const decoded = jwt.verify(token, config.JWT_SECRET) as AuthenticatedUser;
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: { id: true, email: true, name: true, avatar: true },
    });

    if (!user) {
      return res.status(401).json({ success: false, error: 'Unauthorized: User not found' });
    }

    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: 'Unauthorized: Invalid or expired token' });
  }
}
