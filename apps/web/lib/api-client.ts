/**
 * API Client
 * ==========
 *
 * Centralized API client for making requests to the backend
 */

import { ApiResponse } from '@/types';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

let accessToken: string | null = null;
let refreshToken: string | null = null;

export function setTokens(access: string, refresh: string): void {
  accessToken = access;
  refreshToken = refresh;

  if (typeof window !== 'undefined') {
    localStorage.setItem('accessToken', access);
    localStorage.setItem('refreshToken', refresh);
  }
}

export function getAccessToken(): string | null {
  if (accessToken) return accessToken;

  if (typeof window !== 'undefined') {
    // Try localStorage first
    accessToken = localStorage.getItem('accessToken');

    // Fallback to cookie if localStorage is empty
    if (!accessToken) {
      const cookies = document.cookie.split(';');
      for (const cookie of cookies) {
        const [name, value] = cookie.trim().split('=');
        if (name === 'auth-token') {
          accessToken = value;
          // Sync to localStorage
          localStorage.setItem('accessToken', value);
          break;
        }
      }
    }
  }

  return accessToken;
}

export function clearTokens(): void {
  accessToken = null;
  refreshToken = null;

  if (typeof window !== 'undefined') {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    // Also clear cookie
    document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// REQUEST HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

async function refreshAccessToken(): Promise<boolean> {
  const refresh = refreshToken || localStorage.getItem('refreshToken');
  if (!refresh) return false;

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: refresh }),
    });

    if (!response.ok) return false;

    const data = await response.json();
    if (data.success && data.data) {
      setTokens(data.data.accessToken, data.data.refreshToken);
      return true;
    }

    return false;
  } catch {
    return false;
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'GET', body, headers = {}, auth = true } = options;

  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers,
  };

  if (auth) {
    const token = getAccessToken();
    if (token) {
      requestHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  try {
    let response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method,
      headers: requestHeaders,
      body: body ? JSON.stringify(body) : undefined,
    });

    // Handle token refresh on 401
    if (response.status === 401 && auth) {
      const refreshed = await refreshAccessToken();
      if (refreshed) {
        requestHeaders['Authorization'] = `Bearer ${getAccessToken()}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
      } else {
        clearTokens();
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        return {
          success: false,
          error: { code: 'AUTH_EXPIRED', message: 'Session expired' },
        };
      }
    }

    const data = await response.json();
    return data;
  } catch (error) {
    return {
      success: false,
      error: {
        code: 'NETWORK_ERROR',
        message: error instanceof Error ? error.message : 'Network error',
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export const api = {
  // Auth
  auth: {
    requestOtp: (phone: string) =>
      apiRequest<{ sent: boolean }>('/auth/otp/request', {
        method: 'POST',
        body: { phone },
        auth: false,
      }),

    verifyOtp: (phone: string, code: string) =>
      apiRequest<{ accessToken: string; refreshToken: string; user: unknown }>(
        '/auth/otp/verify',
        { method: 'POST', body: { phone, code }, auth: false }
      ),

    // Registration
    register: (data: {
      cuit: string;
      businessName: string;
      adminName: string;
      phone: string;
      email?: string;
    }) =>
      apiRequest<{ sent: boolean; devMode?: boolean; expiresInMinutes: number }>(
        '/auth/register',
        { method: 'POST', body: data, auth: false }
      ),

    verifyRegistration: (phone: string, code: string) =>
      apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: unknown;
        isNewUser: boolean;
      }>('/auth/register/verify', {
        method: 'POST',
        body: { phone, code },
        auth: false,
      }),

    logout: () => apiRequest('/auth/logout', { method: 'POST' }),

    me: () => apiRequest<unknown>('/auth/me'),
  },

  // Organization
  organization: {
    get: () => apiRequest<unknown>('/organization'),
    update: (data: unknown) =>
      apiRequest('/organization', { method: 'PUT', body: data }),
    getSettings: () => apiRequest<unknown>('/organization/settings'),
    updateSettings: (data: unknown) =>
      apiRequest('/organization/settings', { method: 'PUT', body: data }),
  },

  // Users
  users: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return apiRequest<unknown[]>(`/users${query}`);
    },
    get: (id: string) => apiRequest<unknown>(`/users/${id}`),
    create: (data: unknown) =>
      apiRequest('/users', { method: 'POST', body: data }),
    update: (id: string, data: unknown) =>
      apiRequest(`/users/${id}`, { method: 'PUT', body: data }),
    delete: (id: string) =>
      apiRequest(`/users/${id}`, { method: 'DELETE' }),
  },

  // Customers
  customers: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return apiRequest<unknown[]>(`/customers${query}`);
    },
    get: (id: string) => apiRequest<unknown>(`/customers/${id}`),
    create: (data: unknown) =>
      apiRequest('/customers', { method: 'POST', body: data }),
    update: (id: string, data: unknown) =>
      apiRequest(`/customers/${id}`, { method: 'PUT', body: data }),
    delete: (id: string) =>
      apiRequest(`/customers/${id}`, { method: 'DELETE' }),
    search: (query: string) =>
      apiRequest<unknown[]>(`/customers/search?q=${encodeURIComponent(query)}`),
    validateCuit: (cuit: string) =>
      apiRequest<unknown>(`/customers/validate-cuit/${cuit}`),
  },

  // Jobs
  jobs: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return apiRequest<unknown[]>(`/jobs${query}`);
    },
    get: (id: string) => apiRequest<unknown>(`/jobs/${id}`),
    create: (data: unknown) =>
      apiRequest('/jobs', { method: 'POST', body: data }),
    update: (id: string, data: unknown) =>
      apiRequest(`/jobs/${id}`, { method: 'PUT', body: data }),
    updateStatus: (id: string, status: string) =>
      apiRequest(`/jobs/${id}/status`, { method: 'PATCH', body: { status } }),
    assign: (id: string, userId: string) =>
      apiRequest(`/jobs/${id}/assign`, { method: 'PATCH', body: { userId } }),
    today: () => apiRequest<unknown[]>('/jobs/today'),
    calendar: (start: string, end: string) =>
      apiRequest<unknown[]>(`/jobs/calendar?start=${start}&end=${end}`),
  },

  // Invoices
  invoices: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return apiRequest<unknown[]>(`/invoices${query}`);
    },
    get: (id: string) => apiRequest<unknown>(`/invoices/${id}`),
    create: (data: unknown) =>
      apiRequest('/invoices', { method: 'POST', body: data }),
    update: (id: string, data: unknown) =>
      apiRequest(`/invoices/${id}`, { method: 'PUT', body: data }),
    send: (id: string) =>
      apiRequest(`/invoices/${id}/send`, { method: 'POST' }),
    cancel: (id: string) =>
      apiRequest(`/invoices/${id}/cancel`, { method: 'POST' }),
    getPdf: (id: string) =>
      apiRequest<{ url: string }>(`/invoices/${id}/pdf`),
    queueStatus: () => apiRequest<unknown>('/invoices/queue-status'),
  },

  // Payments
  payments: {
    list: (params?: Record<string, string>) => {
      const query = params ? `?${new URLSearchParams(params)}` : '';
      return apiRequest<unknown[]>(`/payments${query}`);
    },
    get: (id: string) => apiRequest<unknown>(`/payments/${id}`),
    createManual: (data: unknown) =>
      apiRequest('/payments/manual', { method: 'POST', body: data }),
    refund: (id: string, amount?: number) =>
      apiRequest(`/payments/${id}/refund`, { method: 'POST', body: { amount } }),
    reconciliation: () => apiRequest<unknown>('/payments/reconciliation'),
    disputes: () => apiRequest<unknown[]>('/payments/disputes'),
  },

  // Dashboard
  dashboard: {
    stats: () => apiRequest<unknown>('/dashboard/stats'),
    recentActivity: () => apiRequest<unknown[]>('/dashboard/activity'),
  },

  // Admin
  admin: {
    health: () => apiRequest<unknown>('/admin/health'),
    queues: () => apiRequest<unknown[]>('/admin/queues'),
    capabilities: () => apiRequest<unknown>('/admin/capabilities'),
    toggleCapability: (capability: string, enabled: boolean) =>
      apiRequest(`/admin/capabilities/${capability}`, {
        method: 'PATCH',
        body: { enabled },
      }),
    dlq: () => apiRequest<unknown[]>('/admin/dlq'),
    retryDlq: (id: string) =>
      apiRequest(`/admin/dlq/${id}/retry`, { method: 'POST' }),
  },

  // Settings
  settings: {
    afip: {
      get: () => apiRequest<unknown>('/settings/afip'),
      update: (data: unknown) =>
        apiRequest('/settings/afip', { method: 'PUT', body: data }),
      uploadCertificate: (file: FormData) =>
        apiRequest('/settings/afip/certificate', {
          method: 'POST',
          body: file,
        }),
      testConnection: () =>
        apiRequest('/settings/afip/test', { method: 'POST' }),
    },
    mercadopago: {
      get: () => apiRequest<unknown>('/settings/mercadopago'),
      getAuthUrl: () =>
        apiRequest<{ url: string }>('/settings/mercadopago/auth-url'),
      disconnect: () =>
        apiRequest('/settings/mercadopago/disconnect', { method: 'POST' }),
    },
    whatsapp: {
      get: () => apiRequest<unknown>('/settings/whatsapp'),
      save: (data: unknown) =>
        apiRequest('/settings/whatsapp', { method: 'PUT', body: data }),
      testConnection: () =>
        apiRequest('/settings/whatsapp/test', { method: 'POST' }),
      resolvePanic: () =>
        apiRequest('/settings/whatsapp/resolve-panic', { method: 'POST' }),
    },
    pricebook: {
      list: () => apiRequest<unknown[]>('/settings/pricebook'),
      create: (data: unknown) =>
        apiRequest('/settings/pricebook', { method: 'POST', body: data }),
      update: (id: string, data: unknown) =>
        apiRequest(`/settings/pricebook/${id}`, { method: 'PUT', body: data }),
      delete: (id: string) =>
        apiRequest(`/settings/pricebook/${id}`, { method: 'DELETE' }),
    },
  },

  // WhatsApp
  whatsapp: {
    conversations: {
      list: (params?: { filter?: string }) => {
        const query = params?.filter ? `?filter=${params.filter}` : '';
        return apiRequest<unknown[]>(`/whatsapp/conversations${query}`);
      },
      get: (id: string) => apiRequest<unknown>(`/whatsapp/conversations/${id}`),
    },
    messages: {
      list: (conversationId: string) =>
        apiRequest<unknown[]>(`/whatsapp/conversations/${conversationId}/messages`),
      send: (conversationId: string, data: { text: string }) =>
        apiRequest(`/whatsapp/conversations/${conversationId}/messages`, {
          method: 'POST',
          body: data,
        }),
    },
    templates: {
      list: () => apiRequest<unknown[]>('/whatsapp/templates'),
      sync: () => apiRequest('/whatsapp/templates/sync', { method: 'POST' }),
      send: (data: { templateName: string; phone: string; params: Record<string, string> }) =>
        apiRequest('/whatsapp/templates/send', { method: 'POST', body: data }),
    },
    stats: () => apiRequest<unknown>('/whatsapp/stats'),
  },

  // Voice AI
  voice: {
    messages: {
      get: (id: string) => apiRequest<unknown>(`/voice/messages/${id}`),
      retry: (id: string) =>
        apiRequest(`/voice/messages/${id}/retry`, { method: 'POST' }),
    },
    reviewQueue: {
      list: (params?: { status?: string }) => {
        const query = params?.status ? `?status=${params.status}` : '';
        return apiRequest<unknown[]>(`/voice/review-queue${query}`);
      },
      stats: () => apiRequest<unknown>('/voice/review-queue/stats'),
    },
    review: {
      submit: (
        id: string,
        data: {
          action: 'approve' | 'edit' | 'reject';
          corrections?: Record<string, unknown>;
          notes?: string;
        }
      ) =>
        apiRequest(`/voice/messages/${id}/review`, {
          method: 'POST',
          body: data,
        }),
    },
    stats: () => apiRequest<unknown>('/voice/stats'),
  },
};
