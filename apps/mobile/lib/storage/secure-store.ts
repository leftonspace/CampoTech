/**
 * Secure Storage
 * ==============
 *
 * Wrapper around expo-secure-store for storing sensitive data.
 */

import * as SecureStore from 'expo-secure-store';

const KEYS = {
  ACCESS_TOKEN: 'campotech_access_token',
  REFRESH_TOKEN: 'campotech_refresh_token',
  USER_ID: 'campotech_user_id',
  ORG_ID: 'campotech_org_id',
  PUSH_TOKEN: 'campotech_push_token',
} as const;

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ACCESS_TOKEN);
}

export async function setAccessToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ACCESS_TOKEN, token);
}

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
}

export async function getUserId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.USER_ID);
}

export async function setUserId(id: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.USER_ID, id);
}

export async function getOrgId(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.ORG_ID);
}

export async function setOrgId(id: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.ORG_ID, id);
}

export async function getPushToken(): Promise<string | null> {
  return SecureStore.getItemAsync(KEYS.PUSH_TOKEN);
}

export async function setPushToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(KEYS.PUSH_TOKEN, token);
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

export async function clearAuth(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(KEYS.ACCESS_TOKEN),
    SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN),
    SecureStore.deleteItemAsync(KEYS.USER_ID),
    SecureStore.deleteItemAsync(KEYS.ORG_ID),
  ]);
}

export async function isAuthenticated(): Promise<boolean> {
  const token = await getAccessToken();
  return token !== null;
}
