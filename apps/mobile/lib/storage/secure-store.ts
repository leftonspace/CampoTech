/**
 * Secure Storage
 * ==============
 *
 * Platform-aware wrapper for storing sensitive data.
 * - Native (iOS/Android): Uses expo-secure-store with device encryption
 * - Web: Uses httpOnly cookies via API (SECURITY FIX MEDIUM-10)
 * 
 * SECURITY FIX (MEDIUM-10): Web platform now uses:
 * 1. httpOnly cookies (managed by server, inaccessible to JS)
 * 2. sessionStorage fallback for non-token data (cleared on tab close)
 * 
 * This prevents XSS token theft on web platform.
 */

import { Platform } from 'react-native';

const KEYS = {
  ACCESS_TOKEN: 'campotech_access_token',
  REFRESH_TOKEN: 'campotech_refresh_token',
  USER_ID: 'campotech_user_id',
  ORG_ID: 'campotech_org_id',
  PUSH_TOKEN: 'campotech_push_token',
} as const;

// Sensitive keys that should NOT be stored in JS-accessible storage on web
const SENSITIVE_KEYS = [KEYS.ACCESS_TOKEN, KEYS.REFRESH_TOKEN] as const;

// ============================================================================
// Platform-aware low-level storage functions
// SECURITY FIX (MEDIUM-10): Web now uses sessionStorage for non-sensitive data
// and relies on httpOnly cookies for tokens (managed server-side)
// ============================================================================

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    // SECURITY FIX (MEDIUM-10): Tokens are now managed via httpOnly cookies
    // The auth-token cookie is set by the server with httpOnly=true
    // Client JS cannot and should not access these tokens directly
    if (SENSITIVE_KEYS.includes(key as typeof SENSITIVE_KEYS[number])) {
      // Return null - tokens are handled via httpOnly cookies
      // The API client should rely on cookie-based auth
      console.warn(`[SecureStore] Token ${key} is managed via httpOnly cookies on web. Use cookie-based auth.`);
      return null;
    }

    // Use sessionStorage for non-sensitive data (cleared on tab close)
    try {
      return sessionStorage.getItem(key);
    } catch {
      return null;
    }
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    // SECURITY FIX (MEDIUM-10): Tokens should not be stored in JS-accessible storage
    if (SENSITIVE_KEYS.includes(key as typeof SENSITIVE_KEYS[number])) {
      console.warn(`[SecureStore] Token ${key} should be managed via httpOnly cookies on web. Ignoring setItem.`);
      return;
    }

    // Use sessionStorage for non-sensitive data
    try {
      sessionStorage.setItem(key, value);
    } catch {
      // Ignore storage errors on web
    }
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.setItemAsync(key, value);
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    // SECURITY FIX (MEDIUM-10): Tokens should be cleared via logout API
    if (SENSITIVE_KEYS.includes(key as typeof SENSITIVE_KEYS[number])) {
      // To clear httpOnly cookies, call the logout endpoint
      console.warn(`[SecureStore] Token ${key} should be cleared via /api/auth/logout on web.`);
      return;
    }

    try {
      sessionStorage.removeItem(key);
    } catch {
      // Ignore storage errors on web
    }
    return;
  }
  const SecureStore = await import('expo-secure-store');
  await SecureStore.deleteItemAsync(key);
}

// ============================================================================
// Token Management
// SECURITY NOTE: On web, tokens are managed via httpOnly cookies.
// These functions work normally on native, but are no-ops on web.
// ============================================================================

export async function getAccessToken(): Promise<string | null> {
  return getItem(KEYS.ACCESS_TOKEN);
}

export async function setAccessToken(token: string): Promise<void> {
  await setItem(KEYS.ACCESS_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return getItem(KEYS.REFRESH_TOKEN);
}

export async function setRefreshToken(token: string): Promise<void> {
  await setItem(KEYS.REFRESH_TOKEN, token);
}

export async function setTokens(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  await Promise.all([
    setAccessToken(accessToken),
    setRefreshToken(refreshToken),
  ]);
}

// ============================================================================
// User Data Management
// ============================================================================

export async function getUserId(): Promise<string | null> {
  return getItem(KEYS.USER_ID);
}

export async function setUserId(id: string): Promise<void> {
  await setItem(KEYS.USER_ID, id);
}

export async function getOrgId(): Promise<string | null> {
  return getItem(KEYS.ORG_ID);
}

export async function setOrgId(id: string): Promise<void> {
  await setItem(KEYS.ORG_ID, id);
}

// ============================================================================
// Push Notifications
// ============================================================================

export async function getPushToken(): Promise<string | null> {
  return getItem(KEYS.PUSH_TOKEN);
}

export async function setPushToken(token: string): Promise<void> {
  await setItem(KEYS.PUSH_TOKEN, token);
}

// ============================================================================
// Auth State
// SECURITY FIX (MEDIUM-10): On web, call /api/auth/logout to clear httpOnly cookies
// ============================================================================

export async function clearAuth(): Promise<void> {
  if (Platform.OS === 'web') {
    // On web, we need to call the logout API to clear httpOnly cookies
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Continue with local cleanup even if logout fails
    }
  }

  await Promise.all([
    deleteItem(KEYS.ACCESS_TOKEN),
    deleteItem(KEYS.REFRESH_TOKEN),
    deleteItem(KEYS.USER_ID),
    deleteItem(KEYS.ORG_ID),
  ]);
}

export async function isAuthenticated(): Promise<boolean> {
  if (Platform.OS === 'web') {
    // On web, check auth via API since we can't access httpOnly cookies
    try {
      const response = await fetch('/api/auth/session', { credentials: 'include' });
      return response.ok;
    } catch {
      return false;
    }
  }

  const token = await getAccessToken();
  return token !== null;
}

