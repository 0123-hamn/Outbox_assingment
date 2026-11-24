export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
}

export interface EmailSender {
  id: string;
  senderName: string;
  senderEmail: string;
  isActive: boolean;
  createdAt: string;
}

export type EmailStatus = 'scheduled' | 'processing' | 'sent' | 'failed' | 'cancelled';

export interface EmailJob {
  id: string;
  userId: string;
  senderId: string;
  recipientEmail: string;
  subject: string;
  body: string;
  scheduledAt: string;
  sentAt?: string | null;
  status: EmailStatus;
  bullJobId?: string | null;
  attempts: number;
  lastError?: string | null;
  previewUrl?: string | null;
  createdAt: string;
  sender?: {
    id: string;
    senderName: string;
    senderEmail: string;
  };
}

export interface EmailStats {
  scheduled: number;
  processing: number;
  sent: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface SlackStatus {
  connected: boolean;
  integration?: {
    teamId: string;
    teamName: string;
    channelName?: string | null;
    connectedAt: string;
  } | null;
}
