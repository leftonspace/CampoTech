/**
 * WhatsApp Customer Module
 * ========================
 */

export {
  normalizePhoneNumber,
  generatePhoneVariants,
  findCustomerByPhone,
  findOrCreateCustomer,
  getOrganizationWAConfig,
  updateCustomerLastInteraction,
} from './customer-matcher';
export type {
  MatchedCustomer,
  CustomerMatchResult,
  CustomerNotFoundResult,
} from './customer-matcher';
