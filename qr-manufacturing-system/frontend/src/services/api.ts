import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Define error response type
interface ApiErrorResponse {
  message: string;
  status: number;
  timestamp: string;
  path?: string;
}

// Base API URL configuration
const BASE_URL = process.env.REACT_APP_API_URL || 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com/api';

// Create axios instance with configuration
const api = axios.create({
  baseURL: BASE_URL,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Development logger
const logApiOperation = (type: string, data: unknown): void => {
  if (process.env.NODE_ENV === 'development') {
    console.log(`API ${type.toUpperCase()}:`, data);
  }
};

// Log initial configuration
logApiOperation('config', {
  baseURL: BASE_URL,
  environment: process.env.NODE_ENV,
  timestamp: new Date().toISOString(),
});

// Request interceptor for authentication and logging
api.interceptors.request.use(
  (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    // Add auth token if available
    const token = localStorage.getItem('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    
    // Log request in development
    logApiOperation('request', {
      url: config.url,
      method: config.method,
      headers: config.headers,
      data: config.data,
    });
    
    return config;
  },
  (error: AxiosError): Promise<AxiosError> => {
    logApiOperation('error', error);
    return Promise.reject(error);
  }
);

// Response interceptor for error handling and logging
api.interceptors.response.use(
  (response: AxiosResponse): AxiosResponse => {
    logApiOperation('response', {
      status: response.status,
      data: response.data,
      url: response.config.url,
    });
    return response;
  },
  (error: AxiosError<ApiErrorResponse>): Promise<AxiosError> => {
    const errorResponse: ApiErrorResponse = {
      message: error.response?.data?.message || 'An unexpected error occurred',
      status: error.response?.status || 500,
      timestamp: new Date().toISOString(),
      path: error.config?.url,
    };

    // Handle unauthorized access
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      window.location.href = '/login';
    }

    logApiOperation('error', errorResponse);
    return Promise.reject(errorResponse);
  }
);

// Export the base URL for use in other files
export const API_URL = BASE_URL;

// Export the configured axios instance
export default api;