import axios from 'axios';
import { environment } from '../config/environment';

export const apiClient = axios.create({
  baseURL: environment.apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

const technicalMessage = /\b(casterror|validationerror|mongo|mongoose|e11000|stack|undefined|cannot read|exception|enotfound|econ[nr])/i;
const friendlyFailure = (error) => {
  if (!error.response) return 'No internet connection. Check your network and try again.';
  if (error.response.status >= 500) return 'The academy server is unavailable. Please try again in a moment.';
  if (error.response.status === 429) return 'Too many requests were sent. Please wait a moment and try again.';
  const message = error.response.data?.message;
  return !message || technicalMessage.test(message) ? 'We could not complete that request. Please check the details and try again.' : message;
};

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = friendlyFailure(error);
    error.message = message;
    error.userMessage = message;
    if (error.response?.data) error.response.data.message = message;
    return Promise.reject(error);
  }
);
