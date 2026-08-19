import { apiClient } from '../api/axios';

export const dashboardService = {
  stats: () => apiClient.get('/dashboard/stats').then((response) => response.data.data),
  androidUpdate: () => apiClient.get('/app/android-update').then((response) => response.data.data),
  purchases: (period = 'month', filters = {}) =>
    apiClient
      .get('/dashboard/purchases', { params: { period, ...filters } })
      .then((response) => response.data.data),
};
