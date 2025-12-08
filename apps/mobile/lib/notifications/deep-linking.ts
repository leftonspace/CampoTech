/**
 * Deep Linking Configuration
 * ==========================
 *
 * Configure URL scheme and universal links for the app
 */

import * as Linking from 'expo-linking';
import { router } from 'expo-router';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

export const DEEP_LINK_PREFIX = Linking.createURL('/');

// URL scheme: campotech://
// Universal links: https://app.campotech.com/

export const linking = {
  prefixes: [
    DEEP_LINK_PREFIX,
    'campotech://',
    'https://app.campotech.com',
    'https://*.campotech.com',
  ],
  config: {
    screens: {
      '(tabs)': {
        screens: {
          today: 'today',
          jobs: {
            screens: {
              index: 'jobs',
              '[id]': 'jobs/:id',
              complete: 'jobs/complete',
            },
          },
          customers: 'customers',
          profile: 'profile',
        },
      },
      '(auth)': {
        screens: {
          login: 'login',
        },
      },
    },
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// URL HANDLERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Handle incoming deep links
 */
export function handleDeepLink(url: string): void {
  // Parse the URL
  const parsed = Linking.parse(url);

  // Route based on path
  if (parsed.path) {
    if (parsed.path.startsWith('jobs/')) {
      const jobId = parsed.path.replace('jobs/', '');
      router.push(`/jobs/${jobId}`);
    } else if (parsed.path === 'today') {
      router.push('/today');
    } else if (parsed.path.startsWith('customers/')) {
      const customerId = parsed.path.replace('customers/', '');
      router.push(`/customers/${customerId}`);
    } else {
      router.push('/');
    }
  }
}

/**
 * Create a deep link URL for sharing
 */
export function createDeepLink(path: string): string {
  return Linking.createURL(path);
}

/**
 * Create a job detail link
 */
export function createJobLink(jobId: string): string {
  return createDeepLink(`jobs/${jobId}`);
}

/**
 * Create a customer detail link
 */
export function createCustomerLink(customerId: string): string {
  return createDeepLink(`customers/${customerId}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXTERNAL LINKS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Open a phone dialer
 */
export function openPhone(phoneNumber: string): void {
  Linking.openURL(`tel:${phoneNumber}`);
}

/**
 * Open SMS app
 */
export function openSMS(phoneNumber: string, body?: string): void {
  const url = body
    ? `sms:${phoneNumber}?body=${encodeURIComponent(body)}`
    : `sms:${phoneNumber}`;
  Linking.openURL(url);
}

/**
 * Open WhatsApp chat
 */
export function openWhatsApp(phoneNumber: string, message?: string): void {
  // Remove non-numeric characters except +
  const cleaned = phoneNumber.replace(/[^\d+]/g, '');
  const url = message
    ? `https://wa.me/${cleaned}?text=${encodeURIComponent(message)}`
    : `https://wa.me/${cleaned}`;
  Linking.openURL(url);
}

/**
 * Open email client
 */
export function openEmail(email: string, subject?: string, body?: string): void {
  let url = `mailto:${email}`;
  const params: string[] = [];

  if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
  if (body) params.push(`body=${encodeURIComponent(body)}`);

  if (params.length > 0) {
    url += `?${params.join('&')}`;
  }

  Linking.openURL(url);
}

/**
 * Open Google Maps with directions
 */
export function openMapsDirections(
  destinationAddress: string,
  originAddress?: string
): void {
  const destination = encodeURIComponent(destinationAddress);
  let url = `https://www.google.com/maps/dir/?api=1&destination=${destination}`;

  if (originAddress) {
    url += `&origin=${encodeURIComponent(originAddress)}`;
  }

  Linking.openURL(url);
}

/**
 * Open Google Maps search
 */
export function openMapsSearch(query: string): void {
  const encoded = encodeURIComponent(query);
  Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${encoded}`);
}

/**
 * Open Waze with navigation
 */
export function openWaze(latitude: number, longitude: number): void {
  Linking.openURL(`https://waze.com/ul?ll=${latitude},${longitude}&navigate=yes`);
}

/**
 * Open app settings (for permissions)
 */
export function openAppSettings(): void {
  Linking.openSettings();
}
