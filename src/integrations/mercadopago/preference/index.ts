/**
 * MercadoPago Preference Module
 * =============================
 *
 * Payment preference building and management
 */

export {
  buildPreferenceItems,
  buildPayerInfo,
  buildPaymentMethods,
  buildPreferenceRequest,
  generateExternalReference,
  parseExternalReference,
  createPreference,
  getPreference,
  updatePreference,
  createSimplePreference,
  calculatePreferenceTotal,
} from './preference.builder';

export type {
  InvoiceLineItem,
  CustomerInfo,
  PreferenceBuildOptions,
  CreatePreferenceResult,
  CreatePreferenceError,
} from './preference.builder';
