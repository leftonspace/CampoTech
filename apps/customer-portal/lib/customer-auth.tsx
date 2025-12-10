'use client';

/**
 * Customer Auth Context
 * =====================
 *
 * React context for customer authentication state.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { customerApi, CustomerProfile } from './customer-api';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface AuthState {
  isAuthenticated: boolean;
  isLoading: boolean;
  customer: CustomerProfile | null;
  orgId: string | null;
}

interface AuthContextType extends AuthState {
  login: (accessToken: string, refreshToken: string, customer: CustomerProfile) => void;
  logout: () => Promise<void>;
  setOrgId: (orgId: string) => void;
  refreshProfile: () => Promise<void>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONTEXT
// ═══════════════════════════════════════════════════════════════════════════════

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function CustomerAuthProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [state, setState] = useState<AuthState>({
    isAuthenticated: false,
    isLoading: true,
    customer: null,
    orgId: null,
  });

  // Load auth state on mount
  useEffect(() => {
    const initAuth = async () => {
      customerApi.loadTokens();

      if (customerApi.isAuthenticated()) {
        try {
          const result = await customerApi.getProfile();
          if (result.success && result.data) {
            setState({
              isAuthenticated: true,
              isLoading: false,
              customer: result.data,
              orgId: result.data.orgId,
            });
            return;
          }
        } catch (error) {
          console.error('Failed to load profile:', error);
        }
      }

      setState(prev => ({ ...prev, isLoading: false }));
    };

    initAuth();
  }, []);

  const login = useCallback((
    accessToken: string,
    refreshToken: string,
    customer: CustomerProfile
  ) => {
    customerApi.setTokens(accessToken, refreshToken);
    customerApi.setOrgId(customer.orgId);
    setState({
      isAuthenticated: true,
      isLoading: false,
      customer,
      orgId: customer.orgId,
    });
  }, []);

  const logout = useCallback(async () => {
    await customerApi.logout();
    setState({
      isAuthenticated: false,
      isLoading: false,
      customer: null,
      orgId: null,
    });
    router.push('/login');
  }, [router]);

  const setOrgId = useCallback((orgId: string) => {
    customerApi.setOrgId(orgId);
    setState(prev => ({ ...prev, orgId }));
  }, []);

  const refreshProfile = useCallback(async () => {
    if (!customerApi.isAuthenticated()) return;

    const result = await customerApi.getProfile();
    if (result.success && result.data) {
      setState(prev => ({ ...prev, customer: result.data! }));
    }
  }, []);

  return (
    <AuthContext.Provider value={{
      ...state,
      login,
      logout,
      setOrgId,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// HOOKS
// ═══════════════════════════════════════════════════════════════════════════════

export function useCustomerAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useCustomerAuth must be used within a CustomerAuthProvider');
  }
  return context;
}

/**
 * Hook for protected routes
 */
export function useRequireAuth() {
  const auth = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated) {
      router.push('/login');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}

/**
 * Hook for guest-only routes (login, etc.)
 */
export function useGuestOnly() {
  const auth = useCustomerAuth();
  const router = useRouter();

  useEffect(() => {
    if (!auth.isLoading && auth.isAuthenticated) {
      router.push('/');
    }
  }, [auth.isLoading, auth.isAuthenticated, router]);

  return auth;
}
