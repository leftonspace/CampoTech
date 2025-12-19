/**
 * Deep Linking Configuration
 * ==========================
 *
 * Handles universal links and deep links for the consumer app.
 *
 * Supported deep links:
 * - campotech://provider/[id]     - Opens provider profile
 * - campotech://rate/[token]      - Opens rating screen
 * - campotech://category/[slug]   - Opens category listing
 *
 * Supported universal links (iOS/Android):
 * - https://campotech.com.ar/provider/[id]  - Opens provider profile
 * - https://campotech.com.ar/rate/[token]   - Opens rating screen
 *
 * If app is not installed, user is redirected to App Store / Play Store.
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';

/**
 * URL scheme for deep links
 */
export const URL_SCHEME = 'campotech';

/**
 * Web domain for universal links
 */
export const WEB_DOMAIN = 'campotech.com.ar';

/**
 * Parse incoming URL and navigate to appropriate screen
 */
export function handleDeepLink(url: string): void {
  try {
    const parsed = Linking.parse(url);
    console.log('Deep link received:', parsed);

    const { hostname, path, queryParams } = parsed;

    // Handle campotech:// scheme
    if (parsed.scheme === URL_SCHEME) {
      handleInternalPath(path || '', queryParams);
      return;
    }

    // Handle https://campotech.com.ar universal links
    if (hostname === WEB_DOMAIN || hostname === `www.${WEB_DOMAIN}`) {
      handleInternalPath(path || '', queryParams);
      return;
    }
  } catch (error) {
    console.error('Error handling deep link:', error);
  }
}

/**
 * Handle internal path navigation
 */
function handleInternalPath(
  path: string,
  queryParams: Record<string, string | undefined> | null
): void {
  // Remove leading slash
  const cleanPath = path.startsWith('/') ? path.slice(1) : path;
  const segments = cleanPath.split('/');

  switch (segments[0]) {
    case 'provider':
      if (segments[1]) {
        router.push({
          pathname: '/provider/[id]',
          params: { id: segments[1], ...queryParams },
        });
      }
      break;

    case 'rate':
      if (segments[1]) {
        router.push({
          pathname: '/rate/[token]',
          params: { token: segments[1] },
        });
      }
      break;

    case 'category':
      if (segments[1]) {
        router.push({
          pathname: '/category/[slug]',
          params: { slug: segments[1] },
        });
      }
      break;

    default:
      // Navigate to home for unknown paths
      router.push('/(tabs)');
  }
}

/**
 * Generate a shareable URL for a provider profile
 */
export function getProviderShareUrl(providerId: string): string {
  return `https://${WEB_DOMAIN}/provider/${providerId}`;
}

/**
 * Generate a shareable URL for a rating link
 */
export function getRatingUrl(token: string): string {
  return `https://${WEB_DOMAIN}/rate/${token}`;
}

/**
 * Generate a deep link URL for a provider profile
 */
export function getProviderDeepLink(providerId: string): string {
  return `${URL_SCHEME}://provider/${providerId}`;
}

/**
 * Generate a deep link URL for a rating
 */
export function getRatingDeepLink(token: string): string {
  return `${URL_SCHEME}://rate/${token}`;
}

/**
 * Create a URL that opens the app or falls back to store
 * This uses the web URL which will redirect appropriately
 */
export function createSmartLink(path: string): string {
  return `https://${WEB_DOMAIN}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Get the App Store URL for iOS
 */
export function getAppStoreUrl(): string {
  return 'https://apps.apple.com/app/campotech/id123456789'; // Replace with actual ID
}

/**
 * Get the Play Store URL for Android
 */
export function getPlayStoreUrl(): string {
  return 'https://play.google.com/store/apps/details?id=tech.campo.consumer';
}
