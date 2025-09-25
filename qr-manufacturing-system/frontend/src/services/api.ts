import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Define error response type
interface ApiErrorResponse {
  message: string;
  status: number;
  timestamp: string;
  path?: string;
}

// Base API URL configuration - always use Render backend
const BASE_URL = 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com';

// Create axios instance with configuration
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// Request interceptor
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    // Remove any localhost:5002 references
    if (config.url?.includes('localhost:5002')) {
      config.url = config.url.replace('http://localhost:5002', '');
    }
    console.log(`Making ${config.method?.toUpperCase()} request to: ${config.baseURL}${config.url}`);
    return config;
  },
  (error) => {
    console.error('Request error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`Response from ${response.config.url}:`, {
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error: AxiosError<ApiErrorResponse>) => {
    console.error('Response error:', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.response?.data?.message || error.message
    });
    return Promise.reject(error);
  }
);

export const API_URL = BASE_URL;
export default api;