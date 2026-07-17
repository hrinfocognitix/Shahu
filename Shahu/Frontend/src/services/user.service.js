import { apiClient } from '../api/axios';
import { endpoints } from '../api/endpoints';

export const userService = {
  list: params => apiClient.get(endpoints.users.list, { params }).then(res => res.data),
  create: payload => apiClient.post(endpoints.users.list, payload).then(res => res.data.data)
};
