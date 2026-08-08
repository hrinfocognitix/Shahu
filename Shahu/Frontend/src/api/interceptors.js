import { toast } from 'react-toastify';
import { apiClient } from './axios';
import { store } from '../redux/store/store';
import { logout } from '../redux/slices/authSlice';
import { STORAGE_KEYS } from '../constants';
import { markRequestPending } from '../utils/requestInteraction';

const pendingWrites = new Map();
const writeMethods = new Set(['post', 'put', 'patch', 'delete']);

const bodyKey = (body) => {
  if (!(body instanceof FormData)) return JSON.stringify(body || {});
  return Array.from(body.entries())
    .map(([name, value]) => [name, value instanceof File ? `${value.name}:${value.size}:${value.lastModified}` : String(value)])
    .map((entry) => entry.join('='))
    .join('&');
};

const requestKey = (config) => {
  return `${config.method}:${config.baseURL || ''}:${config.url}:${bodyKey(config.data)}`;
};

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
    if (writeMethods.has(String(config.method).toLowerCase())) {
      const key = requestKey(config);
      if (pendingWrites.has(key)) {
        const error = new Error('This action is already being processed. Please wait.');
        error.code = 'REQUEST_IN_PROGRESS';
        error.userMessage = error.message;
        error.response = { data: { message: error.message } };
        return Promise.reject(error);
      }
      pendingWrites.set(key, true);
      config._writeRequestKey = key;
      config._restoreControl = markRequestPending();
    }
    return config;
  });

  apiClient.interceptors.response.use(
    (response) => {
      if (response.config?._writeRequestKey) {
        pendingWrites.delete(response.config._writeRequestKey);
        response.config._restoreControl?.();
      }
      return response;
    },
    async (error) => {
      const originalRequest = error.config;
      if (originalRequest?._writeRequestKey) {
        pendingWrites.delete(originalRequest._writeRequestKey);
        originalRequest._restoreControl?.();
      }
      if (error.code === 'REQUEST_IN_PROGRESS') {
        throw error;
      }
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

      // Individual pages provide action-specific error messages. Avoid showing
      // a second, generic toast for the same failed click.
      throw error;
    }
  );
}
