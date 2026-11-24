import { apiClient } from './api';
import { User } from '../types';

export const authApi = {
  getMe: async (): Promise<{ success: boolean; user: User }> => {
    const res = await apiClient.get('/auth/me');
    return res.data;
  },
  logout: async (): Promise<{ success: boolean }> => {
    const res = await apiClient.post('/auth/logout');
    return res.data;
  },
  devLogin: async (email?: string, name?: string): Promise<{ success: boolean; user: User }> => {
    const res = await apiClient.post('/auth/dev-login', { email, name });
    return res.data;
  },
};
