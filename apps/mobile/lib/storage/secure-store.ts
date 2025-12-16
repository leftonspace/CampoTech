/**
 * Secure Storage
 * ==============
 *
 * Platform-aware wrapper for storing sensitive data.
 * - Native (iOS/Android): Uses expo-secure-store with device encryption
 * - Web: Uses localStorage (less secure, but functional)
 */

import { Platform } from 'react-native';

const KEYS = {
  ACCESS_TOKEN: 'campotech_access_token',
  REFRESH_TOKEN: 'campotech_refresh_token',
  USER_ID: 'campotech_user_id',
  ORG_ID: 'campotech_org_id',
  PUSH_TOKEN: 'campotech_push_token',
} as const;

// ============================================================================
// Platform-aware low-level storage functions
// ============================================================================

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  const SecureStore = await import('expo-secure-store');
  return SecureStore.getItemAsync(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
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
    try {
      localStorage.removeItem(key);
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
// ============================================================================

export async function clearAuth(): Promise<void> {
  await Promise.all([
    deleteItem(KEYS.ACCESS_TOKEN),
    deleteItem(KEYS.REFRESH_TOKEN),
    deleteItem(KEYS.USER_ID),
    deleteItem(KEYS.ORG_ID),
  ]);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
