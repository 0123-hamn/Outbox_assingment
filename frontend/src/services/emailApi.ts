import { apiClient } from './api';
import { EmailJob, EmailStats, EmailSender } from '../types';

export interface ScheduleEmailPayload {
  subject: string;
  body: string;
  recipients: string[];
  senderId: string;
  startTime: string;
  delayBetweenEmails: number;
  hourlyLimit: number;
}

export const emailApi = {
  schedule: async (payload: ScheduleEmailPayload) => {
    const res = await apiClient.post('/emails/schedule', payload);
    return res.data;
  },
  getScheduled: async (page = 1, limit = 20) => {
    const res = await apiClient.get(`/emails/scheduled?page=${page}&limit=${limit}`);
    return res.data;
  },
  getSent: async (page = 1, limit = 20, status = 'all') => {
    const res = await apiClient.get(`/emails/sent?page=${page}&limit=${limit}&status=${status}`);
    return res.data;
  },
  getStats: async (): Promise<{ success: boolean; stats: EmailStats }> => {
    const res = await apiClient.get('/emails/stats');
    return res.data;
  },
  search: async (q: string, status?: string, page = 1, limit = 20) => {
    const res = await apiClient.get(`/emails/search?q=${encodeURIComponent(q)}&status=${status || ''}&page=${page}&limit=${limit}`);
    return res.data;
  },
  cancel: async (id: string) => {
    const res = await apiClient.post(`/emails/${id}/cancel`);
    return res.data;
  },
  getSenders: async (): Promise<{ success: boolean; senders: EmailSender[] }> => {
    const res = await apiClient.get('/senders');
    return res.data;
  },
  createSender: async (senderData: { senderName: string; senderEmail: string }) => {
    const res = await apiClient.post('/senders', senderData);
    return res.data;
  },
};
