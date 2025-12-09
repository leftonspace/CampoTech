/**
 * Localization Module
 * ===================
 *
 * Phase 9.7: Argentine Communication Localization
 * Provides localization services for the Argentine market.
 */

// Business Hours & Auto-Responder
export {
  isBusinessOpen,
  checkBusinessHours,
  getBusinessHoursConfig,
  updateBusinessHoursConfig,
  getAutoResponderMessage,
  formatBusinessHoursForDisplay,
  ARGENTINA_TIMEZONE,
  DEFAULT_BUSINESS_HOURS,
  ARGENTINA_HOLIDAYS_2025,
} from './business-hours.service';
export type {
  BusinessHours,
  BusinessHoursConfig,
  BusinessHoursCheck,
  DayHours,
} from './business-hours.service';

// Auto-Responder Service
export {
  processAutoResponse,
  sendMessageReceivedConfirmation,
} from './auto-responder.service';
export type { AutoResponderResult } from './auto-responder.service';

// Phone Number Validation
export {
  validateArgentinePhone,
  isValidArgentinePhone,
  normalizeForWhatsApp,
  formatForDisplay,
  localToInternational,
  internationalToLocal,
  phonesMatch,
  extractFromWhatsAppSender,
  validatePhoneList,
  deduplicatePhones,
  ARGENTINA_COUNTRY_CODE,
  ARGENTINA_AREA_CODES,
} from './phone-validation';
export type { PhoneValidationResult } from './phone-validation';

// Spanish (Argentina) Locale
export {
  esARLocale,
  translations,
  formatCurrency,
  formatDate,
  formatTime,
  formatDateTime,
  formatRelativeDate,
  formatPhone,
  formatCUIT,
  LOCALE_CODE,
  LOCALE_NAME,
  CURRENCY_CODE,
  CURRENCY_SYMBOL,
  TIMEZONE,
  DATE_FORMAT,
  TIME_FORMAT,
} from './es-AR';
