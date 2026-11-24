import { apiClient } from './api';
import { SlackStatus } from '../types';

export const slackApi = {
  getStatus: async (): Promise<SlackStatus> => {
    const res = await apiClient.get('/slack/status');
    return res.data;
  },
  disconnect: async () => {
    const res = await apiClient.post('/slack/disconnect');
    return res.data;
  },
};
