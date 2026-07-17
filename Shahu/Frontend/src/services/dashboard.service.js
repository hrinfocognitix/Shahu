import { apiClient } from '../api/axios';

export const dashboardService = {
  stats: () => apiClient.get('/dashboard/stats').then(response => response.data.data)
};
