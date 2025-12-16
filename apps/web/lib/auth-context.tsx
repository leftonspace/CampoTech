'use client';

/**
 * Auth Context Provider
 * =====================
 *
 * Provides authentication state and methods throughout the app
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, Session } from '@/types';
import { api, setTokens, clearTokens, getAccessToken } from './api-client';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  register: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  requestOtp: (phone: string) => Promise<{ success: boolean; error?: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER
// ═══════════════════════════════════════════════════════════════════════════════

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Check if user is authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      console.log('checkAuth running...');
      const token = getAccessToken();
      console.log('Token from storage:', token ? `${token.substring(0, 20)}...` : 'null');

      if (!token) {
        console.log('No token found, setting isLoading to false');
        setIsLoading(false);
        return;
      }

      try {
        console.log('Calling /api/auth/me...');
        const response = await api.auth.me();
        console.log('auth/me response:', JSON.stringify(response, null, 2));

        if (response.success && response.data) {
          setUser(response.data as User);
        } else {
          console.log('auth/me failed, clearing tokens');
          clearTokens();
        }
      } catch (err) {
        console.log('auth/me error:', err);
        clearTokens();
      } finally {
        setIsLoading(false);
      }
    };

    checkAuth();
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    const response = await api.auth.requestOtp(phone);
    if (response.success) {
      return { success: true };
    }
    return {
      success: false,
      error: response.error?.message || 'Error al enviar el código',
    };
  }, []);

  const login = useCallback(async (phone: string, code: string) => {
    const response = await api.auth.verifyOtp(phone, code);

    console.log('Login response:', JSON.stringify(response, null, 2));

    if (response.success && response.data) {
      const data = response.data as {
        accessToken: string;
        refreshToken: string;
        user: User;
      };

      console.log('Setting tokens, accessToken length:', data.accessToken?.length);
      setTokens(data.accessToken, data.refreshToken);

      // Verify tokens were stored
      const storedToken = localStorage.getItem('accessToken');
      console.log('Stored token length:', storedToken?.length);

      setUser(data.user);

      return { success: true };
    }

    return {
      success: false,
      error: response.error?.message || 'Código incorrecto',
    };
  }, []);

  const register = useCallback(async (phone: string, code: string) => {
    const response = await api.auth.verifyRegistration(phone, code);

    console.log('Register response:', JSON.stringify(response, null, 2));

    if (response.success && response.data) {
      const data = response.data as {
        accessToken: string;
        refreshToken: string;
        user: User;
      };

      console.log('Setting tokens after registration');
      setTokens(data.accessToken, data.refreshToken);
      setUser(data.user);

      return { success: true };
    }

    return {
      success: false,
      error: response.error?.message || 'Error al completar el registro',
    };
  }, []);

  const logout = useCallback(async () => {
    await api.auth.logout();
    clearTokens();
    setUser(null);
    router.push('/login');
  }, [router]);

  const value: AuthContextValue = {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    register,
    logout,
    requestOtp,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOK
// ═══════════════════════════════════════════════════════════════════════════════

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROTECTED ROUTE WRAPPER
// ═══════════════════════════════════════════════════════════════════════════════

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  // Helper for case-insensitive role comparison
  const hasAllowedRole = (role: string | undefined, allowed: string[]) => {
    if (!role) return false;
    const roleUpper = role.toUpperCase();
    return allowed.some(r => r.toUpperCase() === roleUpper);
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }

    if (!isLoading && isAuthenticated && allowedRoles && user) {
      if (!hasAllowedRole(user.role, allowedRoles)) {
        router.push('/dashboard');
      }
    }
  }, [isLoading, isAuthenticated, user, allowedRoles, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (allowedRoles && user && !hasAllowedRole(user.role, allowedRoles)) {
    return null;
  }

  return <>{children}</>;
}
