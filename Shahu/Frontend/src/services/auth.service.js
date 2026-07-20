import { apiClient } from '../api/axios';
import { endpoints } from '../api/endpoints';

export const authService = {
  login: (payload) => apiClient.post(endpoints.auth.login, payload).then((res) => res.data.data),
  requestStudentOtp: (payload) =>
    apiClient.post('/auth/student/request-otp', payload).then((res) => res.data.data),
  verifyStudentOtp: (payload) =>
    apiClient.post('/auth/student/verify-otp', payload).then((res) => res.data.data),
  logout: (refreshToken) =>
    apiClient.post(endpoints.auth.logout, { refreshToken }).then((res) => res.data),
  me: () => apiClient.get(endpoints.users.me).then((res) => res.data.data),
};
