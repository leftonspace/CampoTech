/**
 * Consumer API Client
 * ===================
 *
 * HTTP client for consumer mobile app.
 * Phase 15: Consumer Marketplace
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:3001/api/consumer';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  meta?: {
    total: number;
    page: number;
    totalPages: number;
  };
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  auth?: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

const TOKEN_KEY = 'consumer_access_token';
const REFRESH_TOKEN_KEY = 'consumer_refresh_token';

export async function getAccessToken(): Promise<string | null> {
  return AsyncStorage.getItem(TOKEN_KEY);
}

export async function getRefreshToken(): Promise<string | null> {
  return AsyncStorage.getItem(REFRESH_TOKEN_KEY);
}

export async function setTokens(accessToken: string, refreshToken: string): Promise<void> {
  await AsyncStorage.multiSet([
    [TOKEN_KEY, accessToken],
    [REFRESH_TOKEN_KEY, refreshToken],
  ]);
}

export async function clearTokens(): Promise<void> {
  await AsyncStorage.multiRemove([TOKEN_KEY, REFRESH_TOKEN_KEY]);
}

// ═══════════════════════════════════════════════════════════════════════════════
// TOKEN REFRESH
// ═══════════════════════════════════════════════════════════════════════════════

let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

async function refreshAccessToken(): Promise<boolean> {
  if (isRefreshing && refreshPromise) {
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return false;

      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) return false;

      const data = await response.json();
      if (data.success && data.data) {
        await setTokens(data.data.accessToken, data.data.refreshToken);
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

// ═══════════════════════════════════════════════════════════════════════════════
// API REQUEST
// ═══════════════════════════════════════════════════════════════════════════════

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
    const token = await getAccessToken();
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
        const newToken = await getAccessToken();
        requestHeaders['Authorization'] = `Bearer ${newToken}`;
        response = await fetch(`${API_BASE_URL}${endpoint}`, {
          method,
          headers: requestHeaders,
          body: body ? JSON.stringify(body) : undefined,
        });
      } else {
        await clearTokens();
        return {
          success: false,
          error: { code: 'AUTH_EXPIRED', message: 'Sesión expirada' },
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
        message: error instanceof Error ? error.message : 'Error de conexión',
      },
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// API METHODS
// ═══════════════════════════════════════════════════════════════════════════════

export const consumerApi = {
  // Auth
  auth: {
    requestOtp: (phone: string) =>
      apiRequest<{ sent: boolean; expiresIn: number }>('/auth/otp/request', {
        method: 'POST',
        body: { phone },
        auth: false,
      }),

    verifyOtp: (phone: string, code: string) =>
      apiRequest<{
        accessToken: string;
        refreshToken: string;
        consumer: {
          id: string;
          phone: string;
          displayName?: string;
          isNewUser: boolean;
        };
      }>('/auth/otp/verify', {
        method: 'POST',
        body: { phone, code },
        auth: false,
      }),

    refresh: () =>
      apiRequest<{ accessToken: string; refreshToken: string }>('/auth/refresh', {
        method: 'POST',
      }),

    logout: () => apiRequest('/auth/logout', { method: 'POST' }),

    me: () =>
      apiRequest<{
        id: string;
        phone: string;
        displayName?: string;
        email?: string;
        profilePhotoUrl?: string;
      }>('/auth/me'),
  },

  // Profile
  profile: {
    get: () =>
      apiRequest<{
        id: string;
        phone: string;
        displayName?: string;
        email?: string;
        profilePhotoUrl?: string;
        defaultCity?: string;
        defaultNeighborhood?: string;
        savedAddresses: Array<{
          id: string;
          label: string;
          address: string;
          lat: number;
          lng: number;
          isDefault: boolean;
        }>;
        notificationPreferences: Record<string, boolean>;
        stats: {
          totalRequests: number;
          completedJobs: number;
          reviewsGiven: number;
        };
      }>('/profile'),

    update: (data: {
      displayName?: string;
      email?: string;
      defaultCity?: string;
      defaultNeighborhood?: string;
    }) =>
      apiRequest('/profile', {
        method: 'PUT',
        body: data,
      }),

    updatePhoto: (photoUrl: string) =>
      apiRequest('/profile/photo', {
        method: 'PUT',
        body: { photoUrl },
      }),

    addAddress: (address: {
      label: string;
      address: string;
      lat: number;
      lng: number;
      isDefault?: boolean;
    }) =>
      apiRequest('/profile/addresses', {
        method: 'POST',
        body: address,
      }),

    removeAddress: (addressId: string) =>
      apiRequest(`/profile/addresses/${addressId}`, {
        method: 'DELETE',
      }),

    updateNotifications: (preferences: Record<string, boolean>) =>
      apiRequest('/profile/notifications', {
        method: 'PUT',
        body: preferences,
      }),

    registerFcmToken: (token: string) =>
      apiRequest('/profile/fcm-token', {
        method: 'POST',
        body: { token },
      }),
  },

  // Discovery
  discover: {
    search: (params: {
      q?: string;
      category?: string;
      categories?: string[];
      lat?: number;
      lng?: number;
      radius?: number;
      city?: string;
      neighborhood?: string;
      minRating?: number;
      verified?: boolean;
      emergency?: boolean;
      sortBy?: 'rating' | 'distance' | 'response_time' | 'relevance';
      page?: number;
      limit?: number;
    }) => {
      const queryParams = new URLSearchParams();
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            queryParams.set(key, value.join(','));
          } else {
            queryParams.set(key, String(value));
          }
        }
      });
      return apiRequest<Array<{
        id: string;
        displayName: string;
        slug: string;
        logoUrl?: string;
        shortDescription?: string;
        categories: string[];
        overallRating: number;
        ratingCount: number;
        badges: string[];
        acceptsEmergency: boolean;
        avgResponseTimeHours?: number;
        distance?: number;
        matchScore?: number;
      }>>(`/discover/search?${queryParams}`, { auth: false });
    },

    categories: (city?: string) =>
      apiRequest<Array<{
        id: string;
        name: string;
        nameEn: string;
        icon: string;
        description: string;
        popularServices: string[];
      }>>(`/discover/categories${city ? `?city=${city}` : ''}`, { auth: false }),

    topRated: (params?: { category?: string; city?: string; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.set(key, String(value));
        });
      }
      const query = queryParams.toString();
      return apiRequest<Array<{
        id: string;
        displayName: string;
        logoUrl?: string;
        overallRating: number;
        ratingCount: number;
        badges: string[];
      }>>(`/discover/top-rated${query ? `?${query}` : ''}`, { auth: false });
    },

    featured: (limit?: number) =>
      apiRequest<Array<{
        id: string;
        displayName: string;
        logoUrl?: string;
        shortDescription?: string;
        categories: string[];
      }>>(`/discover/featured${limit ? `?limit=${limit}` : ''}`, { auth: false }),

    neighborhoods: (city: string, category?: string) =>
      apiRequest<Array<{
        name: string;
        businessCount: number;
        avgRating: number;
      }>>(`/discover/neighborhoods?city=${city}${category ? `&category=${category}` : ''}`, {
        auth: false,
      }),

    business: (id: string) =>
      apiRequest<{
        id: string;
        displayName: string;
        slug: string;
        logoUrl?: string;
        coverPhotoUrl?: string;
        description?: string;
        shortDescription?: string;
        galleryPhotos: string[];
        workShowcase: Array<{
          imageUrl: string;
          title?: string;
          description?: string;
        }>;
        categories: string[];
        services: Array<{
          name: string;
          description?: string;
          priceRange?: { min: number; max: number };
        }>;
        serviceAreas: string[];
        workingHours: Record<string, { open: string; close: string }>;
        acceptsEmergency: boolean;
        acceptingNewClients: boolean;
        badges: string[];
        overallRating: number;
        ratingCount: number;
        punctualityRating?: number;
        qualityRating?: number;
        priceRating?: number;
        communicationRating?: number;
        totalJobsCompleted: number;
        yearsOnPlatform: number;
        cuitVerified: boolean;
        licenseVerified: boolean;
        insuranceVerified: boolean;
        highlights: string[];
      }>(`/discover/business/${id}`),

    businessBySlug: (slug: string) =>
      apiRequest(`/discover/business/slug/${slug}`, { auth: false }),
  },

  // Service Requests
  requests: {
    list: (params?: { status?: string; page?: number; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.set(key, String(value));
        });
      }
      const query = queryParams.toString();
      return apiRequest<Array<{
        id: string;
        requestNumber: string;
        title: string;
        category: string;
        status: string;
        urgency: string;
        quoteCount: number;
        createdAt: string;
      }>>(`/requests${query ? `?${query}` : ''}`);
    },

    get: (id: string) =>
      apiRequest<{
        id: string;
        requestNumber: string;
        title: string;
        description: string;
        category: string;
        status: string;
        urgency: string;
        budgetRange?: string;
        preferredSchedule?: string;
        photos: string[];
        address: string;
        city: string;
        neighborhood?: string;
        quoteCount: number;
        quotes: Array<{
          id: string;
          businessName: string;
          businessLogo?: string;
          businessRating: number;
          priceMin: number;
          priceMax: number;
          description: string;
          status: string;
          createdAt: string;
        }>;
        createdAt: string;
      }>(`/requests/${id}`),

    create: (data: {
      title: string;
      description: string;
      category: string;
      urgency: string;
      budgetRange?: string;
      preferredSchedule?: string;
      photos?: string[];
      address: string;
      city: string;
      neighborhood?: string;
      lat: number;
      lng: number;
    }) =>
      apiRequest<{ id: string; requestNumber: string }>('/requests', {
        method: 'POST',
        body: data,
      }),

    cancel: (id: string, reason?: string) =>
      apiRequest(`/requests/${id}/cancel`, {
        method: 'POST',
        body: { reason },
      }),

    stats: () =>
      apiRequest<{
        totalRequests: number;
        openRequests: number;
        inProgressJobs: number;
        completedJobs: number;
      }>('/requests/stats'),
  },

  // Quotes
  quotes: {
    forRequest: (requestId: string) =>
      apiRequest<Array<{
        id: string;
        quoteNumber: string;
        business: {
          id: string;
          displayName: string;
          logoUrl?: string;
          overallRating: number;
          ratingCount: number;
          badges: string[];
        };
        priceMin: number;
        priceMax: number;
        durationHours?: number;
        description: string;
        validUntil: string;
        status: string;
        unreadMessages: number;
        createdAt: string;
      }>>(`/quotes/request/${requestId}`),

    compare: (requestId: string) =>
      apiRequest<{
        quotes: Array<{
          id: string;
          business: {
            displayName: string;
            overallRating: number;
            badges: string[];
          };
          priceMin: number;
          priceMax: number;
          durationHours?: number;
        }>;
        stats: {
          avgPrice: number;
          minPrice: number;
          maxPrice: number;
          avgDuration: number;
          totalQuotes: number;
        };
        recommendation?: {
          bestValue: string;
          fastestResponse: string;
          highestRated: string;
        };
      }>(`/quotes/request/${requestId}/compare`),

    get: (id: string) =>
      apiRequest<{
        id: string;
        quoteNumber: string;
        business: {
          id: string;
          displayName: string;
          logoUrl?: string;
          overallRating: number;
          badges: string[];
        };
        priceMin: number;
        priceMax: number;
        durationHours?: number;
        description: string;
        includesPartsMessage?: string;
        validUntil: string;
        status: string;
        notes?: string;
        messages: Array<{
          id: string;
          senderType: 'consumer' | 'business';
          message: string;
          createdAt: string;
        }>;
      }>(`/quotes/${id}`),

    accept: (id: string) =>
      apiRequest(`/quotes/${id}/accept`, { method: 'POST' }),

    reject: (id: string, reason?: string) =>
      apiRequest(`/quotes/${id}/reject`, {
        method: 'POST',
        body: { reason },
      }),

    sendMessage: (id: string, message: string) =>
      apiRequest(`/quotes/${id}/messages`, {
        method: 'POST',
        body: { message },
      }),
  },

  // Reviews
  reviews: {
    forBusiness: (businessId: string, params?: { page?: number; limit?: number }) => {
      const queryParams = new URLSearchParams();
      if (params) {
        Object.entries(params).forEach(([key, value]) => {
          if (value !== undefined) queryParams.set(key, String(value));
        });
      }
      const query = queryParams.toString();
      return apiRequest<Array<{
        id: string;
        consumerName: string;
        overallRating: number;
        comment?: string;
        businessResponse?: string;
        createdAt: string;
      }>>(`/reviews/business/${businessId}${query ? `?${query}` : ''}`, { auth: false });
    },

    create: (data: {
      businessProfileId: string;
      jobId?: string;
      overallRating: number;
      punctualityRating?: number;
      qualityRating?: number;
      priceRating?: number;
      communicationRating?: number;
      comment?: string;
      wouldRecommend: boolean;
    }) =>
      apiRequest('/reviews', {
        method: 'POST',
        body: data,
      }),

    myReviews: () =>
      apiRequest<Array<{
        id: string;
        businessName: string;
        overallRating: number;
        comment?: string;
        createdAt: string;
      }>>('/reviews/mine'),
  },

  // Favorites
  favorites: {
    list: () =>
      apiRequest<Array<{
        id: string;
        displayName: string;
        logoUrl?: string;
        overallRating: number;
        categories: string[];
      }>>('/favorites'),

    add: (businessId: string) =>
      apiRequest('/favorites', {
        method: 'POST',
        body: { businessId },
      }),

    remove: (businessId: string) =>
      apiRequest(`/favorites/${businessId}`, {
        method: 'DELETE',
      }),

    check: (businessId: string) =>
      apiRequest<{ isFavorite: boolean }>(`/favorites/${businessId}/check`),
  },
};

export default consumerApi;
