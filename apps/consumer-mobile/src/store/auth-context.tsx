/**
 * Consumer Auth Context
 * =====================
 *
 * Authentication state management for consumer app.
 * Phase 15: Consumer Marketplace
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { consumerApi, setTokens, clearTokens, getAccessToken } from '../services/api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface Consumer {
  id: string;
  phone: string;
  displayName?: string;
  email?: string;
  profilePhotoUrl?: string;
}

export interface AuthState {
  consumer: Consumer | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface AuthContextType extends AuthState {
  requestOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (phone: string, code: string) => Promise<{ success: boolean; isNewUser?: boolean; error?: string }>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateConsumer: (updates: Partial<Consumer>) => void;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    consumer: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // Initialize auth state on mount
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      const token = await getAccessToken();
      if (token) {
        const response = await consumerApi.auth.me();
        if (response.success && response.data) {
          setState({
            consumer: response.data,
            isLoading: false,
            isAuthenticated: true,
          });
          return;
        }
      }
    } catch (error) {
      console.error('Auth initialization failed:', error);
    }

    setState({
      consumer: null,
      isLoading: false,
      isAuthenticated: false,
    });
  };

  const requestOtp = useCallback(async (phone: string) => {
    try {
      const response = await consumerApi.auth.requestOtp(phone);
      if (response.success) {
        return { success: true };
      }
      return {
        success: false,
        error: response.error?.message || 'Error al enviar código',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Error de conexión',
      };
    }
  }, []);

  const verifyOtp = useCallback(async (phone: string, code: string) => {
    try {
      const response = await consumerApi.auth.verifyOtp(phone, code);
      if (response.success && response.data) {
        await setTokens(response.data.accessToken, response.data.refreshToken);

        setState({
          consumer: {
            id: response.data.consumer.id,
            phone: response.data.consumer.phone,
            displayName: response.data.consumer.displayName,
          },
          isLoading: false,
          isAuthenticated: true,
        });

        return {
          success: true,
          isNewUser: response.data.consumer.isNewUser,
        };
      }

      return {
        success: false,
        error: response.error?.message || 'Código inválido',
      };
    } catch (error) {
      return {
        success: false,
        error: 'Error de conexión',
      };
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await consumerApi.auth.logout();
    } catch (error) {
      // Ignore logout API errors
    }

    await clearTokens();
    setState({
      consumer: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const response = await consumerApi.auth.me();
      if (response.success && response.data) {
        setState(prev => ({
          ...prev,
          consumer: response.data!,
        }));
      }
    } catch (error) {
      console.error('Failed to refresh user:', error);
    }
  }, []);

  const updateConsumer = useCallback((updates: Partial<Consumer>) => {
    setState(prev => ({
      ...prev,
      consumer: prev.consumer ? { ...prev.consumer, ...updates } : null,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        requestOtp,
        verifyOtp,
        logout,
        refreshUser,
        updateConsumer,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}

export default AuthContext;
