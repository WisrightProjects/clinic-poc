import axios from 'axios';

const BASE_URL = 'http://10.0.2.2:4000/api';

export const apiClient = axios.create({
  baseURL: BASE_URL,
  headers: {
    'Content-Type': 'application/json',
    'x-role': 'attender',
  },
  timeout: 10000,
});
