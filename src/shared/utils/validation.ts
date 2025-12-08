/**
 * Validation Utilities
 * ====================
 *
 * Common validation functions for Argentine business requirements.
 */

import { IVACondition, InvoiceType } from '../types/domain.types';

// ═══════════════════════════════════════════════════════════════════════════════
// CUIT VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate Argentine CUIT/CUIL number
 * Format: XX-XXXXXXXX-X (11 digits)
 */
export function validateCUIT(cuit: string): { valid: boolean; error?: string; formatted?: string } {
  // Remove any formatting
  const cleaned = cuit.replace(/[-\s]/g, '');

  // Check length
  if (cleaned.length !== 11) {
    return { valid: false, error: 'CUIT must be 11 digits' };
  }

  // Check if all digits
  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'CUIT must contain only digits' };
  }

  // Validate prefix (20, 23, 24, 27, 30, 33, 34)
  const prefix = cleaned.substring(0, 2);
  const validPrefixes = ['20', '23', '24', '27', '30', '33', '34'];
  if (!validPrefixes.includes(prefix)) {
    return { valid: false, error: 'Invalid CUIT prefix' };
  }

  // Validate check digit using modulo 11
  const weights = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleaned[i], 10) * weights[i];
  }
  const remainder = sum % 11;
  const checkDigit = remainder === 0 ? 0 : remainder === 1 ? 9 : 11 - remainder;

  if (parseInt(cleaned[10], 10) !== checkDigit) {
    return { valid: false, error: 'Invalid CUIT check digit' };
  }

  // Format as XX-XXXXXXXX-X
  const formatted = `${cleaned.substring(0, 2)}-${cleaned.substring(2, 10)}-${cleaned.substring(10)}`;

  return { valid: true, formatted };
}

/**
 * Determine entity type from CUIT prefix
 */
export function getCUITEntityType(cuit: string): 'persona_fisica' | 'persona_juridica' | 'unknown' {
  const cleaned = cuit.replace(/[-\s]/g, '');
  const prefix = cleaned.substring(0, 2);

  // Personas físicas
  if (['20', '23', '24', '27'].includes(prefix)) {
    return 'persona_fisica';
  }

  // Personas jurídicas
  if (['30', '33', '34'].includes(prefix)) {
    return 'persona_juridica';
  }

  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════════
// IVA CONDITION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Tax rates by IVA condition
 */
export const IVA_RATES: Record<IVACondition, number> = {
  responsable_inscripto: 0.21,
  monotributista: 0.21,
  exento: 0,
  consumidor_final: 0.21,
};

/**
 * Determine invoice type based on seller and buyer IVA conditions
 * Per AFIP regulations
 */
export function determineInvoiceType(
  sellerIVA: IVACondition,
  buyerIVA: IVACondition
): InvoiceType {
  // Seller is Responsable Inscripto
  if (sellerIVA === 'responsable_inscripto') {
    if (buyerIVA === 'responsable_inscripto') {
      return 'A'; // RI to RI = Factura A
    }
    if (buyerIVA === 'monotributista' || buyerIVA === 'exento' || buyerIVA === 'consumidor_final') {
      return 'B'; // RI to others = Factura B
    }
  }

  // Seller is Monotributista
  if (sellerIVA === 'monotributista') {
    return 'C'; // Monotributista always issues Factura C
  }

  // Seller is Exento
  if (sellerIVA === 'exento') {
    return 'C'; // Exento issues Factura C
  }

  // Default to B for safety
  return 'B';
}

/**
 * Calculate tax amount
 */
export function calculateTax(
  subtotal: number,
  taxRate: number
): { taxAmount: number; total: number } {
  const taxAmount = Math.round(subtotal * taxRate * 100) / 100;
  const total = Math.round((subtotal + taxAmount) * 100) / 100;
  return { taxAmount, total };
}

/**
 * Calculate line item totals
 */
export function calculateLineItem(
  quantity: number,
  unitPrice: number,
  taxRate: number
): { subtotal: number; taxAmount: number; total: number } {
  const subtotal = Math.round(quantity * unitPrice * 100) / 100;
  return {
    subtotal,
    ...calculateTax(subtotal, taxRate),
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize Argentine phone number to E.164 format
 */
export function normalizePhone(phone: string): string {
  // Remove all non-digit characters
  let cleaned = phone.replace(/\D/g, '');

  // Handle Argentine numbers
  if (cleaned.startsWith('54')) {
    // Already has country code
  } else if (cleaned.startsWith('9') && cleaned.length === 11) {
    // Mobile with 9 prefix (549XXXXXXXXX format without country code)
    cleaned = '54' + cleaned;
  } else if (cleaned.length === 10) {
    // 10-digit local number (area code + number)
    cleaned = '549' + cleaned;
  } else if (cleaned.length === 11 && cleaned.startsWith('15')) {
    // Old format with 15 prefix
    cleaned = '549' + cleaned.slice(2);
  } else if (cleaned.length === 8) {
    // 8-digit number (Buenos Aires without area code)
    cleaned = '54911' + cleaned;
  }

  return '+' + cleaned;
}

/**
 * Validate phone number
 */
export function validatePhone(phone: string): { valid: boolean; error?: string; normalized?: string } {
  const normalized = normalizePhone(phone);

  // Should be +54 followed by 10-12 digits
  if (!/^\+54\d{10,12}$/.test(normalized)) {
    return { valid: false, error: 'Invalid Argentine phone number' };
  }

  return { valid: true, normalized };
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Validate email address
 */
export function validateEmail(email: string): { valid: boolean; error?: string } {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  if (!emailRegex.test(email)) {
    return { valid: false, error: 'Invalid email format' };
  }

  if (email.length > 254) {
    return { valid: false, error: 'Email too long' };
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// MONEY FORMATTING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format money for display (ARS)
 */
export function formatMoney(amount: number, currency: string = 'ARS'): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Parse money string to number
 */
export function parseMoney(value: string): number {
  // Remove currency symbol and thousands separators
  const cleaned = value.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned) || 0;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATE VALIDATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if date is in the future
 */
export function isFutureDate(date: Date): boolean {
  return date.getTime() > Date.now();
}

/**
 * Check if date is today
 */
export function isToday(date: Date): boolean {
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  );
}

/**
 * Get start of day
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get end of day
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}
