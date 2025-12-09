/**
 * Phone Number Validation & Formatting
 * =====================================
 *
 * Phase 9.7: Argentine Communication Localization
 * Validates and formats phone numbers for Argentine WhatsApp integration.
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

export const ARGENTINA_COUNTRY_CODE = '54';

// Argentine area codes (mobile prefixes after removing 9)
export const ARGENTINA_AREA_CODES = [
  // Buenos Aires
  '11', // CABA & GBA
  // Major cities
  '351', // Córdoba
  '341', // Rosario
  '261', // Mendoza
  '381', // Tucumán
  '342', // Santa Fe
  '343', // Paraná
  '379', // Corrientes
  '387', // Salta
  '388', // Jujuy
  '376', // Posadas
  '299', // Neuquén
  '2804', // Rawson/Trelew
  '280', // Puerto Madryn
  '2901', // Ushuaia
  '2920', // Viedma
  '2966', // Río Gallegos
  // More area codes...
];

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface PhoneValidationResult {
  isValid: boolean;
  normalized: string | null;
  whatsappFormat: string | null;
  displayFormat: string | null;
  isMobile: boolean;
  countryCode: string | null;
  areaCode: string | null;
  localNumber: string | null;
  errors: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate and normalize an Argentine phone number
 */
export function validateArgentinePhone(input: string): PhoneValidationResult {
  const errors: string[] = [];

  // Clean input
  const cleaned = input.replace(/[\s\-\(\)\.]/g, '');

  // Remove leading + if present
  const digits = cleaned.replace(/^\+/, '');

  // Check minimum length
  if (digits.length < 10) {
    return {
      isValid: false,
      normalized: null,
      whatsappFormat: null,
      displayFormat: null,
      isMobile: false,
      countryCode: null,
      areaCode: null,
      localNumber: null,
      errors: ['El número es muy corto. Debe tener al menos 10 dígitos.'],
    };
  }

  // Parse the number
  let countryCode: string;
  let nationalNumber: string;

  if (digits.startsWith('54')) {
    countryCode = '54';
    nationalNumber = digits.slice(2);
  } else if (digits.startsWith('0')) {
    countryCode = '54';
    nationalNumber = digits.slice(1);
  } else if (digits.length === 10) {
    countryCode = '54';
    nationalNumber = digits;
  } else {
    // Assume it's an international number
    countryCode = digits.slice(0, 2);
    nationalNumber = digits.slice(2);
  }

  // For Argentine numbers, check if it's mobile
  let isMobile = false;
  let areaCode: string;
  let localNumber: string;

  // Remove leading 9 for mobile numbers (WhatsApp format)
  if (nationalNumber.startsWith('9')) {
    nationalNumber = nationalNumber.slice(1);
    isMobile = true;
  }

  // Remove leading 15 for mobile numbers (local format)
  if (nationalNumber.includes('15')) {
    const parts = nationalNumber.split('15');
    if (parts.length === 2 && parts[0].length <= 4) {
      areaCode = parts[0];
      localNumber = parts[1];
      isMobile = true;
    } else {
      areaCode = nationalNumber.slice(0, 2);
      localNumber = nationalNumber.slice(2);
    }
  } else {
    // Determine area code length (2, 3, or 4 digits)
    if (nationalNumber.startsWith('11')) {
      areaCode = '11';
      localNumber = nationalNumber.slice(2);
      isMobile = localNumber.length === 8;
    } else if (nationalNumber.length === 10) {
      // 10 digit number: 2/3 digit area + 7/8 local
      areaCode = nationalNumber.slice(0, 3);
      localNumber = nationalNumber.slice(3);
      isMobile = true; // Most 10-digit are mobile
    } else {
      areaCode = nationalNumber.slice(0, 2);
      localNumber = nationalNumber.slice(2);
    }
  }

  // Validate local number length
  if (localNumber.length < 6 || localNumber.length > 8) {
    errors.push('El número local debe tener entre 6 y 8 dígitos.');
  }

  // Build normalized formats
  const normalized = `${countryCode}${areaCode}${localNumber}`;

  // WhatsApp format: 54 + 9 + area + local (for mobile)
  // For WhatsApp, mobile numbers need the 9 prefix
  const whatsappFormat = isMobile
    ? `${countryCode}9${areaCode}${localNumber}`
    : `${countryCode}${areaCode}${localNumber}`;

  // Display format
  const displayFormat = formatForDisplay(countryCode, areaCode, localNumber, isMobile);

  return {
    isValid: errors.length === 0,
    normalized,
    whatsappFormat,
    displayFormat,
    isMobile,
    countryCode,
    areaCode,
    localNumber,
    errors,
  };
}

/**
 * Quick check if a number looks like a valid Argentine phone
 */
export function isValidArgentinePhone(input: string): boolean {
  const result = validateArgentinePhone(input);
  return result.isValid;
}

/**
 * Normalize phone number for WhatsApp API
 */
export function normalizeForWhatsApp(input: string): string | null {
  const result = validateArgentinePhone(input);
  return result.whatsappFormat;
}

/**
 * Format phone for display
 */
export function formatForDisplay(
  countryCode: string,
  areaCode: string,
  localNumber: string,
  isMobile: boolean
): string {
  // Format: +54 11 1234-5678
  const first = localNumber.slice(0, 4);
  const second = localNumber.slice(4);

  if (isMobile) {
    return `+${countryCode} ${areaCode} ${first}-${second}`;
  }

  return `+${countryCode} ${areaCode} ${first}-${second}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONVERSION UTILITIES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Convert from local format (011 15 1234-5678) to international (54 9 11 12345678)
 */
export function localToInternational(localNumber: string): string | null {
  const result = validateArgentinePhone(localNumber);
  return result.normalized;
}

/**
 * Convert from international to local display format
 */
export function internationalToLocal(internationalNumber: string): string | null {
  const result = validateArgentinePhone(internationalNumber);
  if (!result.isValid) return null;

  // Format: (011) 15-1234-5678 for mobile
  if (result.isMobile && result.areaCode && result.localNumber) {
    const first = result.localNumber.slice(0, 4);
    const second = result.localNumber.slice(4);
    return `(0${result.areaCode}) 15-${first}-${second}`;
  }

  // Format: (011) 1234-5678 for landline
  if (result.areaCode && result.localNumber) {
    const first = result.localNumber.slice(0, 4);
    const second = result.localNumber.slice(4);
    return `(0${result.areaCode}) ${first}-${second}`;
  }

  return null;
}

/**
 * Check if two phone numbers are the same (after normalization)
 */
export function phonesMatch(phone1: string, phone2: string): boolean {
  const normalized1 = normalizeForWhatsApp(phone1);
  const normalized2 = normalizeForWhatsApp(phone2);

  if (!normalized1 || !normalized2) return false;

  // Also try without 9 prefix
  const withoutNine1 = normalized1.replace(/^549/, '54');
  const withoutNine2 = normalized2.replace(/^549/, '54');

  return normalized1 === normalized2 || withoutNine1 === withoutNine2;
}

/**
 * Extract phone from WhatsApp message sender format
 */
export function extractFromWhatsAppSender(waId: string): PhoneValidationResult {
  // WhatsApp sends numbers as: 5491112345678
  return validateArgentinePhone(waId);
}

// ═══════════════════════════════════════════════════════════════════════════════
// BATCH VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate multiple phone numbers
 */
export function validatePhoneList(phones: string[]): {
  valid: PhoneValidationResult[];
  invalid: PhoneValidationResult[];
} {
  const valid: PhoneValidationResult[] = [];
  const invalid: PhoneValidationResult[] = [];

  for (const phone of phones) {
    const result = validateArgentinePhone(phone);
    if (result.isValid) {
      valid.push(result);
    } else {
      invalid.push(result);
    }
  }

  return { valid, invalid };
}

/**
 * Deduplicate phone list (keeping first occurrence)
 */
export function deduplicatePhones(phones: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const phone of phones) {
    const normalized = normalizeForWhatsApp(phone);
    if (normalized && !seen.has(normalized)) {
      seen.add(normalized);
      result.push(phone);
    }
  }

  return result;
}
