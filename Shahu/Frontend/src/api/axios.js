import axios from 'axios';
import { environment } from '../config/environment';

export const apiClient = axios.create({
  baseURL: environment.apiBaseUrl,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});
