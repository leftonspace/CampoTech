/**
 * Consumer Auth Hook
 * ==================
 *
 * Phase 15: Consumer Marketplace
 * Authentication hook for consumer users.
 */

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as SecureStore from '../../storage/secure-store';
import { apiRequest } from '../../api/client';

interface ConsumerProfile {
  id: string;
  phone: string;
  firstName: string;
  lastName?: string;
  profilePhotoUrl?: string;
  neighborhood?: string;
  city?: string;
  totalRequests?: number;
  totalJobsCompleted?: number;
  totalReviewsGiven?: number;
  referralCode?: string;
}

interface ConsumerAuthContextType {
  consumer: ConsumerProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  updateProfile: (data: Partial<ConsumerProfile>) => Promise<{ success: boolean; error?: string }>;
}

const ConsumerAuthContext = createContext<ConsumerAuthContextType | null>(null);

export function useConsumerAuth() {
  const context = useContext(ConsumerAuthContext);
  if (!context) {
    // Return a default context for development
    return {
      consumer: null,
      isLoading: false,
      isAuthenticated: false,
      login: async () => ({ success: false, error: 'Not implemented' }),
      logout: async () => {},
      requestOtp: async () => ({ success: false, error: 'Not implemented' }),
      updateProfile: async () => ({ success: false, error: 'Not implemented' }),
    };
  }
  return context;
}

export function ConsumerAuthProvider({ children }: { children: React.ReactNode }) {
  const [consumer, setConsumer] = useState<ConsumerProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const authenticated = await SecureStore.isAuthenticated();

      if (authenticated) {
        const response = await apiRequest<ConsumerProfile>('/consumer/profiles/me');
        if (response.success && response.data) {
          setConsumer(response.data);
        } else {
          await SecureStore.clearAuth();
        }
      }
    } catch (error) {
      console.error('Consumer auth check failed:', error);
      await SecureStore.clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const requestOtp = async (phone: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiRequest<{ sent: boolean }>('/consumer/auth/login', {
        method: 'POST',
        body: { phone },
        auth: false,
      });

      if (response.success && response.data?.sent) {
        return { success: true };
      }

      return {
        success: false,
        error: response.error?.message || 'No se pudo enviar el codigo',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al enviar codigo',
      };
    }
  };

  const login = async (phone: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiRequest<{
        accessToken: string;
        refreshToken: string;
        consumer: ConsumerProfile;
      }>('/consumer/auth/verify', {
        method: 'POST',
        body: { phone, code },
        auth: false,
      });

      if (!response.success || !response.data) {
        return {
          success: false,
          error: response.error?.message || 'Codigo incorrecto',
        };
      }

      const { accessToken, refreshToken, consumer: consumerData } = response.data;

      await SecureStore.setTokens(accessToken, refreshToken);
      setConsumer(consumerData);

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al iniciar sesion',
      };
    }
  };

  const logout = async () => {
    try {
      await apiRequest('/consumer/auth/logout', { method: 'POST' });
    } catch {
      // Ignore server errors on logout
    }

    await SecureStore.clearAuth();
    setConsumer(null);
  };

  const updateProfile = async (
    data: Partial<ConsumerProfile>
  ): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await apiRequest<ConsumerProfile>('/consumer/profiles/me', {
        method: 'PUT',
        body: data,
      });

      if (response.success && response.data) {
        setConsumer(response.data);
        return { success: true };
      }

      return {
        success: false,
        error: response.error?.message || 'No se pudo actualizar el perfil',
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Error al actualizar perfil',
      };
    }
  };

  return (
    <ConsumerAuthContext.Provider
      value={{
        consumer,
        isLoading,
        isAuthenticated: !!consumer,
        login,
        logout,
        requestOtp,
        updateProfile,
      }}
    >
      {children}
    </ConsumerAuthContext.Provider>
  );
}

export default useConsumerAuth;
