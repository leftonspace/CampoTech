/**
 * Auth Context
 * ============
 *
 * Provides authentication state and methods throughout the app.
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as SecureStore from '../storage/secure-store';
import { api } from '../api/client';
import { database, userSessionCollection } from '../../watermelon/database';
import { performSync } from '../sync/sync-engine';

interface User {
  id: string;
  name: string;
  phone: string;
  role: string;
  organizationId: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  mode: 'simple' | 'advanced';
  login: (phone: string, code: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  setMode: (mode: 'simple' | 'advanced') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mode, setModeState] = useState<'simple' | 'advanced'>('simple');

  const router = useRouter();
  const segments = useSegments();

  // Check auth state on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  // Handle navigation based on auth state
  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === '(auth)';

    if (!user && !inAuthGroup) {
      // Not authenticated, redirect to login
      router.replace('/(auth)/login');
    } else if (user && inAuthGroup) {
      // Authenticated, redirect to main app
      router.replace('/(tabs)/today');
    }
  }, [user, segments, isLoading]);

  const checkAuthState = async () => {
    try {
      const authenticated = await SecureStore.isAuthenticated();

      if (authenticated) {
        // Try to get user from local session first
        const sessions = await userSessionCollection.query().fetch();
        if (sessions.length > 0) {
          const session = sessions[0] as any;
          setUser({
            id: session.userId,
            name: session.name,
            phone: session.phone,
            role: session.role,
            organizationId: session.organizationId,
          });
          setModeState(session.mode || 'simple');
        } else {
          // Fetch from server
          const response = await api.auth.me();
          if (response.success && response.data) {
            setUser(response.data);
            // Save to local session
            await saveUserSession(response.data);
          } else {
            await SecureStore.clearAuth();
          }
        }
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      await SecureStore.clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (phone: string, code: string): Promise<{ success: boolean; error?: string }> => {
    try {
      const response = await api.auth.verifyOtp(phone, code);

      if (!response.success || !response.data) {
        return { success: false, error: response.error?.message || 'Login failed' };
      }

      const { accessToken, refreshToken, user: userData } = response.data;

      // Save tokens
      await SecureStore.setTokens(accessToken, refreshToken);
      await SecureStore.setUserId(userData.id);
      await SecureStore.setOrgId(userData.organizationId);

      // Save to local session
      await saveUserSession(userData);

      setUser(userData);

      // Trigger initial sync after login to populate local database
      performSync().catch((error) => {
        console.warn('Initial sync after login failed:', error);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Login failed',
      };
    }
  };

  const logout = async () => {
    try {
      await api.auth.logout();
    } catch {
      // Ignore server errors on logout
    }

    await SecureStore.clearAuth();

    // Clear local session
    await database.write(async () => {
      const sessions = await userSessionCollection.query().fetch();
      for (const session of sessions) {
        await session.destroyPermanently();
      }
    });

    setUser(null);
    router.replace('/(auth)/login');
  };

  const setMode = async (newMode: 'simple' | 'advanced') => {
    setModeState(newMode);

    // Update local session
    await database.write(async () => {
      const sessions = await userSessionCollection.query().fetch();
      if (sessions.length > 0) {
        await sessions[0].update((s: any) => {
          s.mode = newMode;
        });
      }
    });
  };

  const saveUserSession = async (userData: User) => {
    await database.write(async () => {
      // Clear existing sessions
      const existing = await userSessionCollection.query().fetch();
      for (const session of existing) {
        await session.destroyPermanently();
      }

      // Create new session
      await userSessionCollection.create((session: any) => {
        session.userId = userData.id;
        session.organizationId = userData.organizationId;
        session.name = userData.name;
        session.phone = userData.phone;
        session.role = userData.role;
        session.mode = 'simple';
      });
    });
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        mode,
        login,
        logout,
        setMode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
