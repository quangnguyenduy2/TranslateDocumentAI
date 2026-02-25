/// <reference types="vite/client" />
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

const API_URL = import.meta.env?.VITE_API_URL || 'http://localhost:5000/api';

// Create axios instance with base configuration
const apiClient = axios.create({
  baseURL: API_URL,
  withCredentials: true, // Send httpOnly cookies (refresh token)
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor: Add Bearer token to all requests
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem('accessToken');
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);


// Response interceptor: Auto-refresh token on 401
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    // If 401 error and not already retried
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Call refresh endpoint (refreshToken sent via httpOnly cookie)
        const response = await axios.post(
          `${API_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;

        // Save new access token
        localStorage.setItem('accessToken', accessToken);

        // Retry original request with new token
        if (originalRequest.headers) {
          originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        }
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, clear tokens and redirect to login
        localStorage.removeItem('accessToken');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (email: string, password: string) =>
    apiClient.post('/auth/register', { email, password }),
  
  login: (email: string, password: string) =>
    apiClient.post('/auth/login', { email, password }),
  
  logout: () => apiClient.post('/auth/logout'),
  
  getMe: () => apiClient.get('/auth/me'),
  
  refresh: () => apiClient.post('/auth/refresh'),
  
  updateApiKey: (apiKey: string) =>
    apiClient.post('/auth/api-key', { apiKey }),
  
  getApiKey: () => apiClient.get('/auth/api-key'),
};

// Translation API
export const translationAPI = {
  translateText: (data: {
    text: string;
    targetLang: string;
    sourceLang?: string;
    context?: string;
    glossary?: Array<{ source: string; target: string }>;
    blacklist?: Array<{ text: string; caseSensitive?: boolean }>;
  }) => apiClient.post('/translate/text', data),
  
  translateBatch: (data: {
    texts: string[];
    targetLang: string;
    sourceLang?: string;
    context?: string;
    glossary?: Array<{ source: string; target: string }>;
    blacklist?: Array<{ text: string; caseSensitive?: boolean }>;
  }) => apiClient.post('/translate/batch', data),
  
  extractText: (data: { base64Data: string; mimeType: string }) =>
    apiClient.post('/translate/extract-text', data),
};

// User Data API
export const userDataAPI = {
  // Glossary
  getGlossary: () => apiClient.get('/user-data/glossary'),
  saveGlossary: (items: Array<{ term: string; translation: string }>) =>
    apiClient.put('/user-data/glossary', { items }),
  addGlossaryItem: (item: { term: string; translation: string }) =>
    apiClient.post('/user-data/glossary', item),
  deleteGlossaryItem: (id: string) =>
    apiClient.delete(`/user-data/glossary/${id}`),

  // Blacklist
  getBlacklist: () => apiClient.get('/user-data/blacklist'),
  saveBlacklist: (items: Array<{ term: string; caseSensitive?: boolean; enabled?: boolean }>) =>
    apiClient.put('/user-data/blacklist', { items }),
  addBlacklistItem: (item: { term: string; caseSensitive?: boolean; enabled?: boolean }) =>
    apiClient.post('/user-data/blacklist', item),
  deleteBlacklistItem: (id: string) =>
    apiClient.delete(`/user-data/blacklist/${id}`),

  // History
  getHistory: () => apiClient.get('/user-data/history'),
  addHistoryItem: (item: { fileName: string; fileType: string; targetLang: string; timestamp: number }) =>
    apiClient.post('/user-data/history', item),
  deleteHistoryItem: (id: string) =>
    apiClient.delete(`/user-data/history/${id}`),
  clearHistory: () =>
    apiClient.delete('/user-data/history'),

  // Preferences
  getPreferences: () => apiClient.get('/user-data/preferences'),
  updatePreferences: (data: { context?: string; blacklistEnabled?: boolean }) =>
    apiClient.put('/user-data/preferences', data),
};

export default apiClient;
