/**
 * Internationalization (i18n) Module
 * ===================================
 *
 * Phase 9.7: Argentine Communication Localization
 * Provides localized strings for the CampoTech platform.
 */

import esAR from './locales/es-AR.json';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type Locale = 'es-AR';
export type LocaleData = typeof esAR;

// ═══════════════════════════════════════════════════════════════════════════════
// LOCALES
// ═══════════════════════════════════════════════════════════════════════════════

const locales: Record<Locale, LocaleData> = {
  'es-AR': esAR,
};

// Default locale for Argentina
const DEFAULT_LOCALE: Locale = 'es-AR';

// ═══════════════════════════════════════════════════════════════════════════════
// TRANSLATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get locale data
 */
export function getLocale(locale: Locale = DEFAULT_LOCALE): LocaleData {
  return locales[locale] || locales[DEFAULT_LOCALE];
}

/**
 * Get a translated string by key path
 * @param key Dot-separated path (e.g., 'jobs.status.pending')
 * @param params Optional interpolation parameters
 * @param locale Locale to use (default: es-AR)
 */
export function t(
  key: string,
  params?: Record<string, string | number>,
  locale: Locale = DEFAULT_LOCALE
): string {
  const localeData = getLocale(locale);
  const keys = key.split('.');

  let value: any = localeData;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      console.warn(`Translation key not found: ${key}`);
      return key;
    }
  }

  if (typeof value !== 'string') {
    console.warn(`Translation key is not a string: ${key}`);
    return key;
  }

  // Interpolate parameters
  if (params) {
    return value.replace(/\{\{(\w+)\}\}/g, (_, param) => {
      return params[param]?.toString() || '';
    });
  }

  return value;
}

/**
 * Check if a translation key exists
 */
export function hasTranslation(key: string, locale: Locale = DEFAULT_LOCALE): boolean {
  const localeData = getLocale(locale);
  const keys = key.split('.');

  let value: any = localeData;
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      return false;
    }
  }

  return typeof value === 'string';
}

/**
 * Get all available locales
 */
export function getAvailableLocales(): Locale[] {
  return Object.keys(locales) as Locale[];
}

/**
 * Format currency for Argentina
 */
export function formatCurrency(amount: number, locale: Locale = DEFAULT_LOCALE): string {
  const localeData = getLocale(locale);
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: localeData.currency.code,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Format date for Argentina
 */
export function formatDate(
  date: Date | string,
  format: 'short' | 'long' | 'time' | 'datetime' = 'short'
): string {
  const dateObj = typeof date === 'string' ? new Date(date) : date;

  const options: Intl.DateTimeFormatOptions = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    time: { hour: '2-digit', minute: '2-digit', hour12: false },
    datetime: { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false },
  }[format];

  return new Intl.DateTimeFormat('es-AR', options).format(dateObj);
}

/**
 * Format phone number for Argentina
 */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');

  // Argentine mobile format: +54 9 XX XXXX-XXXX
  if (digits.startsWith('549')) {
    const areaCode = digits.slice(3, 5);
    const firstPart = digits.slice(5, 9);
    const secondPart = digits.slice(9);
    return `+54 9 ${areaCode} ${firstPart}-${secondPart}`;
  }

  // Argentine landline format: +54 XX XXXX-XXXX
  if (digits.startsWith('54')) {
    const areaCode = digits.slice(2, 4);
    const firstPart = digits.slice(4, 8);
    const secondPart = digits.slice(8);
    return `+54 ${areaCode} ${firstPart}-${secondPart}`;
  }

  return phone;
}

/**
 * Format CUIT
 */
export function formatCuit(cuit: string): string {
  const digits = cuit.replace(/\D/g, '');
  if (digits.length !== 11) return cuit;

  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

export { esAR };
export default { t, getLocale, formatCurrency, formatDate, formatPhone, formatCuit };
