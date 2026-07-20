import { toast } from 'react-toastify';
import { apiClient } from './axios';
import { endpoints } from './endpoints';
import { store } from '../redux/store/store';
import { logout } from '../redux/slices/authSlice';
import { STORAGE_KEYS } from '../constants';

const endSession = () => {
  localStorage.removeItem(STORAGE_KEYS.auth);
  store.dispatch(logout());
};

export function setupInterceptors() {
  apiClient.interceptors.request.use((config) => {
    const token = store.getState().auth.accessToken;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    const isFormData = typeof FormData !== 'undefined' && config.data instanceof FormData;
    if (isFormData) {
      if (config.headers) {
        delete config.headers['Content-Type'];
        delete config.headers.common;
      }
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
      const originalRequest = error.config;
      const status = error.response?.status;
      const expiredPlan =
        status === 403 &&
        /course plan has expired|not active/i.test(error.response?.data?.message || '');
      if ((status === 401 || expiredPlan) && !originalRequest?._sessionEnded) {
        originalRequest._sessionEnded = true;
        endSession();
        if (expiredPlan)
          toast.error('Your course validity has ended. Please renew your plan.', {
            autoClose: 7000,
          });
        window.location.assign('/login');
      }

      toast.error(error.response?.data?.message || 'Request failed');
      throw error;
    }
  );
}
