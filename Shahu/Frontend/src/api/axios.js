import axios from 'axios';
import { environment } from '../config/environment';

export const apiClient = axios.create({
  baseURL: environment.apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (!error.response) error.message = 'No internet connection. Check your network and try again.';
    else if (error.response.status >= 500) error.message = 'The academy server is unavailable. Please try again in a moment.';
    return Promise.reject(error);
  }
);
