/**
 * API Client
 * ==========
 *
 * HTTP client for server communication with automatic token refresh.
 */

import { Platform } from 'react-native';
import * as SecureStore from '../storage/secure-store';

// For development: Use localhost for web, LAN IP for native devices
// Find your IP with: ipconfig (Windows) or ifconfig (Mac/Linux)
const DEV_API_URL_NATIVE = 'http://192.168.0.19:3000/api';  // Update this to your computer's IP
const DEV_API_URL_WEB = 'http://localhost:3000/api';

// Auto-detect: use localhost for web browsers, LAN IP for native
const DEV_API_URL = Platform.OS === 'web' ? DEV_API_URL_WEB : DEV_API_URL_NATIVE;

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || DEV_API_URL;

// Debug: Log the API URL on startup
console.log('[API Client] Platform:', Platform.OS);
console.log('[API Client] Using API_BASE_URL:', API_BASE_URL);
console.log('[API Client] EXPO_PUBLIC_API_URL env:', process.env.EXPO_PUBLIC_API_URL);

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await SecureStore.getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.success && data.data) {
        await SecureStore.setTokens(
          data.data.accessToken,
          data.data.refreshToken
        );
        return true;
      }

      return false;
    } catch {
      return false;
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
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
    const token = await SecureStore.getAccessToken();
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
        const newToken = await SecureStore.getAccessToken();
        requestHeaders['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
      } else {
        await SecureStore.clearAuth();
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

// API Methods
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
      apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          name: string;
          phone: string;
          role: string;
          organizationId: string;
        };
      }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code },
        auth: false,
      }),

    logout: () => apiRequest('/auth/logout', { method: 'POST' }),

    me: () =>
      apiRequest<{
        id: string;
        name: string;
        phone: string;
        role: string;
        organizationId: string;
      }>('/auth/me'),

    registerPushToken: (data: { token: string; platform: string; deviceId: string }) =>
      apiRequest('/auth/push-token', {
        method: 'POST',
        body: data,
      }),

    unregisterPushToken: (deviceId: string) =>
      apiRequest(`/auth/push-token/${deviceId}`, {
        method: 'DELETE',
      }),
  },

  // Jobs
  jobs: {
    list: (params?: { status?: string; date?: string; customerId?: string; limit?: number }) => {
      const query = params
        ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]) as [string, string][]
        )}`
        : '';
      return apiRequest<unknown[]>(`/jobs${query}`);
    },

    get: (id: string) => apiRequest<unknown>(`/jobs/${id}`),

    updateStatus: (id: string, status: string, data?: Record<string, unknown>) =>
      apiRequest(`/jobs/${id}/status`, {
        method: 'PATCH',
        body: { status, ...data },
      }),

    complete: (
      id: string,
      data: {
        completionNotes: string;
        materialsUsed: Array<{ name: string; quantity: number; price: number }>;
        signatureUrl?: string;
        photos?: string[];
      }
    ) =>
      apiRequest(`/jobs/${id}/complete`, {
        method: 'POST',
        body: data,
      }),

    today: () => apiRequest<unknown[]>('/jobs/today'),

    assigned: () => apiRequest<unknown[]>('/jobs/assigned'),

    // Confirmation Code System (Phase 4.4)
    confirmationCode: {
      // Send confirmation code to customer
      send: (jobId: string) =>
        apiRequest<{
          codeSent: boolean;
          sentAt: string;
        }>(`/jobs/${jobId}/confirmation-code`, {
          method: 'POST',
        }),

      // Verify code entered by technician
      verify: (jobId: string, code: string) =>
        apiRequest<{
          verified: boolean;
        }>(`/jobs/${jobId}/confirmation-code`, {
          method: 'PUT',
          body: { code },
        }),

      // Get code status
      status: (jobId: string) =>
        apiRequest<{
          codeRequired: boolean;
          codeSent: boolean;
          codeVerified: boolean;
          attemptsRemaining: number;
        }>(`/jobs/${jobId}/confirmation-code`),
    },
  },

  // Customers
  customers: {
    list: (params?: { limit?: number; offset?: number; search?: string }) => {
      const query = params
        ? `?${new URLSearchParams(
          Object.entries(params)
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => [k, String(v)]) as [string, string][]
        )}`
        : '';
      return apiRequest<unknown[]>(`/customers${query}`);
    },
    get: (id: string) => apiRequest<unknown>(`/customers/${id}`),
    search: (query: string) =>
      apiRequest<unknown[]>(`/customers/search?q=${encodeURIComponent(query)}`),
    delete: (id: string) =>
      apiRequest('/customers/${id}', { method: 'DELETE' }),
  },

  // Price Book
  pricebook: {
    list: () => apiRequest<unknown[]>('/pricebook'),
  },

  // Inventory (Phase 2.2 - Cascade deduction)
  inventory: {
    // Use materials with automatic cascade (vehicle first, then warehouse)
    useMaterials: (
      jobId: string,
      items: Array<{ productId: string; quantity: number }>
    ) =>
      apiRequest<{
        deductions: Array<{
          productId: string;
          productName: string;
          quantity: number;
          source: 'vehicle' | 'warehouse';
          sourceName: string;
        }>;
        summary: string;
      }>('/inventory/job-materials', {
        method: 'POST',
        body: {
          action: 'useCascade',
          jobId,
          items,
        },
      }),

    // Check availability before deduction
    checkAvailability: (
      jobId: string,
      items: Array<{ productId: string; quantity: number }>
    ) =>
      apiRequest<{
        available: boolean;
        details: Array<{
          productId: string;
          productName: string;
          required: number;
          vehicleAvailable: number;
          warehouseAvailable: number;
          canFulfill: boolean;
          suggestedSource: 'vehicle' | 'warehouse' | 'insufficient';
        }>;
      }>('/inventory/job-materials', {
        method: 'POST',
        body: {
          action: 'checkAvailability',
          jobId,
          items,
        },
      }),
  },

  // Routes (Phase 2.3 - Multi-Stop Navigation)
  routes: {
    // Get today's route
    getToday: () =>
      apiRequest<{
        segments: Array<{
          segmentNumber: number;
          jobIds: string[];
          origin: string;
          destination: string;
          waypoints: string[];
          url: string;
          distanceMeters: number;
          durationSeconds: number;
        }>;
        totalJobs: number;
        totalDistance: number;
        totalDuration: number;
        primaryUrl: string;
        totalSegments: number;
      } | null>('/routes'),

    // Generate route for a date
    generate: (technicianId: string, date?: string) =>
      apiRequest<{
        segments: Array<{
          segmentNumber: number;
          jobIds: string[];
          url: string;
          distanceMeters: number;
          durationSeconds: number;
        }>;
        totalJobs: number;
        totalDistance: number;
        totalDuration: number;
        primaryUrl: string;
        totalSegments: number;
      }>('/routes', {
        method: 'POST',
        body: { technicianId, date },
      }),
  },

  // Sync
  sync: {
    pull: (lastSync?: number) => {
      const query = lastSync ? `?since=${lastSync}` : '';
      return apiRequest<{
        jobs: unknown[];
        customers: unknown[];
        priceBook: unknown[];
        serverTime: number;
      }>(`/sync/pull${query}`);
    },

    push: (operations: Array<{ type: string; entity: string; data: unknown }>) =>
      apiRequest<{
        processed: number;
        conflicts: Array<{
          entityType: string;
          entityId: string;
          serverData: unknown;
        }>;
      }>('/sync/push', {
        method: 'POST',
        body: { operations },
      }),

    uploadPhoto: async (localUri: string, jobId: string, type: string) => {
      // This would use FormData for file upload
      return apiRequest<{ url: string }>('/sync/upload-photo', {
        method: 'POST',
        body: { localUri, jobId, type },
      });
    },
  },

  // Push notifications
  notifications: {
    register: (token: string, platform: string) =>
      apiRequest('/notifications/register', {
        method: 'POST',
        body: { token, platform },
      }),

    unregister: () =>
      apiRequest('/notifications/unregister', { method: 'POST' }),
  },

  // GPS Tracking
  tracking: {
    start: (jobId: string, initialLat: number, initialLng: number) =>
      apiRequest<{
        sessionId: string;
        token: string;
        trackingUrl: string;
        expiresAt: string;
      }>('/tracking/start', {
        method: 'POST',
        body: { jobId, initialLat, initialLng },
      }),

    update: (data: {
      lat: number;
      lng: number;
      jobId?: string | null;
      sessionId?: string | null;
      speed?: number | null;
      heading?: number | null;
      accuracy?: number | null;
      altitude?: number | null;
    }) =>
      apiRequest<{
        recorded: boolean;
        sessionId?: string;
        etaMinutes?: number;
        arrived?: boolean;
        movementMode?: string;
      }>('/tracking/update', {
        method: 'POST',
        body: data,
      }),

    stop: (sessionId: string) =>
      apiRequest('/tracking/status', {
        method: 'POST',
        body: { sessionId, status: 'COMPLETED' },
      }),

    getSession: (sessionId: string) =>
      apiRequest<{
        sessionId: string;
        jobId: string;
        status: string;
        startedAt: string;
        coordinates: Array<{ lat: number; lng: number; timestamp: string }>;
      }>(`/tracking/session/${sessionId}`),

    updateLocation: (sessionId: string, data: {
      lat: number;
      lng: number;
      speed?: number | null;
      heading?: number | null;
      accuracy?: number | null;
      timestamp?: string;
    }) =>
      apiRequest('/tracking/location', {
        method: 'POST',
        body: { sessionId, ...data },
      }),
  },

  // Voice transcription (Whisper API)
  transcription: {
    transcribe: async (audioUri: string) => {
      // Upload audio file for transcription
      const token = await SecureStore.getAccessToken();

      const formData = new FormData();
      formData.append('audio', {
        uri: audioUri,
        type: 'audio/m4a',
        name: 'voice_note.m4a',
      } as any);

      try {
        const response = await fetch(`${API_BASE_URL}/transcription/whisper`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
          body: formData,
        });

        const data = await response.json();
        return data as ApiResponse<{ text: string; duration: number; language: string }>;
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'TRANSCRIPTION_ERROR',
            message: error instanceof Error ? error.message : 'Transcription failed',
          },
        } as ApiResponse<{ text: string; duration: number; language: string }>;
      }
    },
  },

  // Map data (dispatcher live map)
  map: {
    getTechnicianLocations: (params?: { onlineOnly?: boolean }) => {
      const query = params?.onlineOnly !== undefined
        ? `?onlineOnly=${params.onlineOnly}`
        : '';
      return apiRequest<{
        technicians: Array<{
          id: string;
          name: string;
          phone: string;
          avatar: string | null;
          specialty: string | null;
          skillLevel: string | null;
          isOnline: boolean;
          lastSeen: string | null;
          location: {
            lat: number;
            lng: number;
            accuracy: number | null;
            heading: number | null;
            speed: number | null;
          } | null;
          currentJob: {
            id: string;
            jobNumber: string;
            status: string;
            description: string | null;
            scheduledDate: string;
            scheduledTimeSlot: unknown | null;
            customerName: string | null;
            address: string | null;
          } | null;
          tracking: {
            sessionId: string;
            status: string;
            etaMinutes: number | null;
            movementMode: string;
          } | null;
        }>;
        stats: {
          total: number;
          online: number;
          enRoute: number;
          working: number;
          available: number;
        };
        updatedAt: string;
      }>(`/tracking/locations${query}`);
    },

    getMapData: (params?: { layers?: string[]; date?: string }) => {
      const queryParams = new URLSearchParams();
      if (params?.layers) queryParams.set('layers', params.layers.join(','));
      if (params?.date) queryParams.set('date', params.date);
      const query = queryParams.toString() ? `?${queryParams.toString()}` : '';
      return apiRequest<{
        customers: Array<{
          id: string;
          name: string;
          lat: number;
          lng: number;
          address: string;
          phone: string;
          jobCount: number;
          lastJobDate: string | null;
          hasActiveJob: boolean;
        }>;
        technicians: Array<{
          id: string;
          name: string;
          lat: number;
          lng: number;
          status: 'en_linea' | 'en_camino' | 'trabajando' | 'sin_conexion';
          currentJobId: string | null;
          currentJobNumber: string | null;
          lastUpdated: string | null;
          avatarUrl: string | null;
          specialty: string | null;
          phone: string;
          currentCustomerName: string | null;
          etaMinutes: number | null;
          heading: number | null;
          locationSource: 'current' | 'home' | 'office';
          nextJob: {
            id: string;
            jobNumber: string;
            customerName: string;
            scheduledTime: string | null;
          } | null;
        }>;
        todayJobs: Array<{
          id: string;
          jobNumber: string;
          lat: number;
          lng: number;
          status: string;
          customerId: string;
          customerName: string;
          customerPhone: string;
          technicianId: string | null;
          technicianName: string | null;
          scheduledTime: string | null;
          arrivedAt: string | null;
          address: string;
          description: string;
          serviceType: string;
        }>;
        stats: {
          totalCustomers: number;
          customersWithLocation: number;
          totalTechnicians: number;
          techniciansOnline: number;
          techniciansEnRoute: number;
          techniciansWorking: number;
          techniciansOffline: number;
          todayJobsTotal: number;
          todayJobsPending: number;
          todayJobsInProgress: number;
          todayJobsCompleted: number;
        };
        updatedAt: string;
      }>(`/map/data${query}`);
    },
  },

  // Employee invites
  invites: {
    get: (token: string) =>
      apiRequest<{
        organizationName: string;
        organizationLogo?: string;
        role: string;
        invitedBy: string;
        expiresAt: string;
      }>(`/invites/${token}`, {
        auth: false,
      }),

    requestOtp: (token: string, phone: string) =>
      apiRequest<{ sent: boolean }>(`/invites/${token}/request-otp`, {
        method: 'POST',
        body: { phone },
        auth: false,
      }),

    accept: (token: string, phone: string, code: string) =>
      apiRequest<{
        accessToken: string;
        refreshToken: string;
        user: {
          id: string;
          name: string;
          phone: string;
          role: string;
          organizationId: string;
        };
      }>(`/invites/${token}/accept`, {
        method: 'POST',
        body: { phone, code },
        auth: false,
      }),
  },

  // Phase 4.3: Digital Entry Badge
  badge: {
    // Get current user's badge data
    get: (userId: string) =>
      apiRequest<{
        technician: {
          id: string;
          name: string;
          photo: string | null;
          specialty: string | null;
          phone: string;
        };
        organization: {
          id: string;
          name: string;
          logo: string | null;
        };
        verification: {
          artStatus: 'valid' | 'expiring' | 'expired' | 'missing';
          artExpiry: string | null;
          artProvider: string | null;
          artPolicyNumber: string | null;
          backgroundCheck: 'pending' | 'approved' | 'rejected' | 'expired';
          backgroundCheckDate: string | null;
          backgroundCheckProvider: string | null;
        };
        qrPayload: string;
        generatedAt: string;
        validUntil: string | null;
        isValid: boolean;
      }>(`/users/${userId}/badge`),

    // Refresh badge token
    refresh: (userId: string) =>
      apiRequest<{
        technician: {
          id: string;
          name: string;
          photo: string | null;
          specialty: string | null;
          phone: string;
        };
        organization: {
          id: string;
          name: string;
          logo: string | null;
        };
        verification: {
          artStatus: 'valid' | 'expiring' | 'expired' | 'missing';
          artExpiry: string | null;
          artProvider: string | null;
          artPolicyNumber: string | null;
          backgroundCheck: 'pending' | 'approved' | 'rejected' | 'expired';
          backgroundCheckDate: string | null;
          backgroundCheckProvider: string | null;
        };
        qrPayload: string;
        generatedAt: string;
        validUntil: string | null;
        isValid: boolean;
        refreshed: boolean;
      }>(`/users/${userId}/badge/refresh`, {
        method: 'POST',
      }),
  },
};

export default api;
