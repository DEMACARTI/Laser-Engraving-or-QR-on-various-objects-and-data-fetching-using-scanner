import axios, { InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';

// Define error response type
interface ApiErrorResponse {
  message: string;
  status: number;
  timestamp: string;
  path?: string;
}

// Base API URL configuration with Vercel and local development support
const BASE_URL = 
  process.env.NEXT_PUBLIC_API_URL || 
  process.env.REACT_APP_API_URL || 
  (window.location.hostname === 'localhost' 
    ? 'http://localhost:5002'
    : 'https://laser-engraving-or-qr-on-various-objects-gbbk.onrender.com');

// Log configuration in development
console.log('API Configuration:', {
  hostname: window.location.hostname,
  BASE_URL,
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  REACT_APP_API_URL: process.env.REACT_APP_API_URL,
  NODE_ENV: process.env.NODE_ENV
});

// Remove trailing /api if it exists in the environment variable
const apiBaseUrl = BASE_URL.endsWith('/api') ? BASE_URL : `${BASE_URL}/api`;

// Create axios instance with configuration
const api = axios.create({
  baseURL: apiBaseUrl,
  timeout: 30000, // 30 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,PUT,POST,DELETE,PATCH,OPTIONS',
    'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept'
  },
  withCredentials: false
});

// Add a retry mechanism
api.interceptors.response.use(undefined, async (error) => {
  if (error.config && error.response && (error.response.status === 429 || error.response.status === 503)) {
    // Retry the request up to 3 times with exponential backoff
    const backoff = new Promise((resolve) => {
      setTimeout(resolve, 1000 * Math.pow(2, error.config.__retryCount || 0));
    });
    
    error.config.__retryCount = (error.config.__retryCount || 0) + 1;
    
    if (error.config.__retryCount <= 3) {
      await backoff;
      return api(error.config);
    }
  }
  return Promise.reject(error);
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