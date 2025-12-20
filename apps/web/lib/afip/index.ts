/**
 * AFIP Integration Module
 * =======================
 *
 * Provides CUIT/CUIL validation and business information retrieval
 * from AFIP (Administración Federal de Ingresos Públicos).
 *
 * Usage:
 * ```typescript
 * import { afipClient, validateCUITFormat } from '@/lib/afip';
 *
 * // Validate format only (synchronous)
 * const format = validateCUITFormat('20-12345678-9');
 *
 * // Full AFIP validation (async)
 * const result = await afipClient.validateCUIT('20-12345678-9');
 * ```
 */

// Main client
export { afipClient, createAFIPClient } from './client';

// Validation functions
export {
  validateCUITFormat,
  validateCUITCheckDigit,
  calculateCUITCheckDigit,
  getCUITEntityType,
} from './client';

// Activity code mappings
export {
  AFIP_ACTIVITY_MAPPINGS,
  CAMPOTECH_SERVICE_TYPES,
  getActivityMapping,
  matchActivityToServices,
  hasHVACActivity,
  getServiceTypesFromActivities,
  calculateActivityMatchScore,
  getServiceCategoryName,
  formatActivityCode,
} from './activity-codes';

// Types
export type {
  CUITValidationResult,
  AFIPPersonaInfo,
  CUITFormatValidation,
  CUITEntityType,
  CUITPrefix,
  AFIPClientConfig,
  AFIPServiceStatus,
  ActivityCode,
  MappedServiceType,
  CategoriaTributaria,
  DomicilioFiscal,
  AFIPEstado,
  AFIPError,
  CUITAutoVerifyResponse,
  ActivityCodeMatchResult,
} from './types';

export type { ServiceCategory, CampoTechServiceType } from './activity-codes';
