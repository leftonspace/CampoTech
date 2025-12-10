/**
 * Barcode & SKU Generator
 * Phase 12.2: Automatic code generation for products
 */

import type {
  SKUGeneratorConfig,
  BarcodeGeneratorConfig,
  GeneratedCode,
} from './product.types';

// ═══════════════════════════════════════════════════════════════════════════════
// SKU GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_SKU_CONFIG: SKUGeneratorConfig = {
  prefix: 'PRD',
  includeCategory: true,
  sequenceLength: 5,
  separator: '-',
};

/**
 * Generate a unique SKU for a product
 */
export async function generateSKU(
  organizationId: string,
  categoryCode: string | null,
  getNextSequence: (orgId: string) => Promise<number>,
  config: Partial<SKUGeneratorConfig> = {}
): Promise<GeneratedCode> {
  const cfg = { ...DEFAULT_SKU_CONFIG, ...config };
  const parts: string[] = [];

  // Add prefix
  if (cfg.prefix) {
    parts.push(cfg.prefix);
  }

  // Add category code
  if (cfg.includeCategory && categoryCode) {
    parts.push(categoryCode.toUpperCase().slice(0, 4));
  }

  // Get next sequence number
  const sequence = await getNextSequence(organizationId);
  const sequenceStr = sequence.toString().padStart(cfg.sequenceLength || 5, '0');
  parts.push(sequenceStr);

  return {
    code: parts.join(cfg.separator || '-'),
    type: 'sku',
    format: 'CUSTOM',
  };
}

/**
 * Generate SKU from product name
 */
export function generateSKUFromName(
  name: string,
  sequence: number,
  config: Partial<SKUGeneratorConfig> = {}
): GeneratedCode {
  const cfg = { ...DEFAULT_SKU_CONFIG, ...config };

  // Clean and extract initials from name
  const words = name
    .toUpperCase()
    .replace(/[^A-Z0-9\s]/g, '')
    .split(/\s+/)
    .filter(Boolean);

  let nameCode: string;
  if (words.length >= 3) {
    // Use first letter of first 3 words
    nameCode = words.slice(0, 3).map(w => w[0]).join('');
  } else if (words.length === 2) {
    // Use first 2 letters of each word
    nameCode = words.map(w => w.slice(0, 2)).join('');
  } else {
    // Use first 4 letters of single word
    nameCode = words[0]?.slice(0, 4) || 'XXX';
  }

  const parts: string[] = [];
  if (cfg.prefix) parts.push(cfg.prefix);
  parts.push(nameCode);
  parts.push(sequence.toString().padStart(cfg.sequenceLength || 4, '0'));

  return {
    code: parts.join(cfg.separator || '-'),
    type: 'sku',
    format: 'NAME_BASED',
  };
}

/**
 * Validate SKU format
 */
export function validateSKU(sku: string): { valid: boolean; error?: string } {
  if (!sku || sku.trim().length === 0) {
    return { valid: false, error: 'SKU no puede estar vacío' };
  }

  if (sku.length < 3) {
    return { valid: false, error: 'SKU debe tener al menos 3 caracteres' };
  }

  if (sku.length > 50) {
    return { valid: false, error: 'SKU no puede exceder 50 caracteres' };
  }

  // Only alphanumeric, dash, underscore
  if (!/^[A-Za-z0-9\-_]+$/.test(sku)) {
    return { valid: false, error: 'SKU solo puede contener letras, números, guiones y guiones bajos' };
  }

  return { valid: true };
}

// ═══════════════════════════════════════════════════════════════════════════════
// BARCODE GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

const DEFAULT_BARCODE_CONFIG: BarcodeGeneratorConfig = {
  type: 'EAN13',
  prefix: '779', // Argentina prefix
  sequenceLength: 9,
};

/**
 * Calculate EAN-13 check digit
 */
function calculateEAN13CheckDigit(code: string): number {
  if (code.length !== 12) {
    throw new Error('EAN-13 code (without check digit) must be 12 digits');
  }

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = parseInt(code[i], 10);
    sum += digit * (i % 2 === 0 ? 1 : 3);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit;
}

/**
 * Calculate EAN-8 check digit
 */
function calculateEAN8CheckDigit(code: string): number {
  if (code.length !== 7) {
    throw new Error('EAN-8 code (without check digit) must be 7 digits');
  }

  let sum = 0;
  for (let i = 0; i < 7; i++) {
    const digit = parseInt(code[i], 10);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }

  const checkDigit = (10 - (sum % 10)) % 10;
  return checkDigit;
}

/**
 * Generate EAN-13 barcode
 */
export async function generateEAN13(
  organizationId: string,
  getNextSequence: (orgId: string) => Promise<number>,
  config: Partial<BarcodeGeneratorConfig> = {}
): Promise<GeneratedCode> {
  const cfg = { ...DEFAULT_BARCODE_CONFIG, ...config };

  const sequence = await getNextSequence(organizationId);
  const prefix = cfg.prefix || '779';

  // Build 12-digit code (without check digit)
  const sequenceLength = 12 - prefix.length;
  const sequenceStr = sequence.toString().padStart(sequenceLength, '0');
  const code12 = prefix + sequenceStr;

  // Calculate check digit
  const checkDigit = calculateEAN13CheckDigit(code12);

  return {
    code: code12 + checkDigit.toString(),
    type: 'barcode',
    format: 'EAN13',
  };
}

/**
 * Generate EAN-8 barcode
 */
export async function generateEAN8(
  organizationId: string,
  getNextSequence: (orgId: string) => Promise<number>,
  config: Partial<BarcodeGeneratorConfig> = {}
): Promise<GeneratedCode> {
  const sequence = await getNextSequence(organizationId);

  // Build 7-digit code (without check digit)
  const code7 = sequence.toString().padStart(7, '0');

  // Calculate check digit
  const checkDigit = calculateEAN8CheckDigit(code7);

  return {
    code: code7 + checkDigit.toString(),
    type: 'barcode',
    format: 'EAN8',
  };
}

/**
 * Generate internal barcode (alphanumeric)
 */
export async function generateInternalBarcode(
  organizationId: string,
  getNextSequence: (orgId: string) => Promise<number>,
  config: Partial<BarcodeGeneratorConfig> = {}
): Promise<GeneratedCode> {
  const cfg = { ...DEFAULT_BARCODE_CONFIG, ...config };

  const sequence = await getNextSequence(organizationId);
  const prefix = cfg.prefix || 'INT';
  const sequenceStr = sequence.toString().padStart(cfg.sequenceLength || 8, '0');

  return {
    code: `${prefix}${sequenceStr}`,
    type: 'barcode',
    format: 'INTERNAL',
  };
}

/**
 * Generate barcode based on type
 */
export async function generateBarcode(
  organizationId: string,
  getNextSequence: (orgId: string) => Promise<number>,
  config: Partial<BarcodeGeneratorConfig> = {}
): Promise<GeneratedCode> {
  const cfg = { ...DEFAULT_BARCODE_CONFIG, ...config };

  switch (cfg.type) {
    case 'EAN13':
      return generateEAN13(organizationId, getNextSequence, cfg);
    case 'EAN8':
      return generateEAN8(organizationId, getNextSequence, cfg);
    case 'INTERNAL':
    case 'CODE128':
    default:
      return generateInternalBarcode(organizationId, getNextSequence, cfg);
  }
}

/**
 * Validate EAN-13 barcode
 */
export function validateEAN13(code: string): { valid: boolean; error?: string } {
  if (!code || code.length !== 13) {
    return { valid: false, error: 'EAN-13 debe tener exactamente 13 dígitos' };
  }

  if (!/^\d{13}$/.test(code)) {
    return { valid: false, error: 'EAN-13 solo puede contener dígitos' };
  }

  // Validate check digit
  const code12 = code.slice(0, 12);
  const expectedCheckDigit = calculateEAN13CheckDigit(code12);
  const actualCheckDigit = parseInt(code[12], 10);

  if (expectedCheckDigit !== actualCheckDigit) {
    return { valid: false, error: 'Dígito verificador inválido' };
  }

  return { valid: true };
}

/**
 * Validate EAN-8 barcode
 */
export function validateEAN8(code: string): { valid: boolean; error?: string } {
  if (!code || code.length !== 8) {
    return { valid: false, error: 'EAN-8 debe tener exactamente 8 dígitos' };
  }

  if (!/^\d{8}$/.test(code)) {
    return { valid: false, error: 'EAN-8 solo puede contener dígitos' };
  }

  // Validate check digit
  const code7 = code.slice(0, 7);
  const expectedCheckDigit = calculateEAN8CheckDigit(code7);
  const actualCheckDigit = parseInt(code[7], 10);

  if (expectedCheckDigit !== actualCheckDigit) {
    return { valid: false, error: 'Dígito verificador inválido' };
  }

  return { valid: true };
}

/**
 * Validate any barcode format
 */
export function validateBarcode(code: string): { valid: boolean; format?: string; error?: string } {
  if (!code || code.trim().length === 0) {
    return { valid: false, error: 'Código de barras no puede estar vacío' };
  }

  // Try EAN-13
  if (code.length === 13 && /^\d{13}$/.test(code)) {
    const ean13Result = validateEAN13(code);
    if (ean13Result.valid) {
      return { valid: true, format: 'EAN13' };
    }
  }

  // Try EAN-8
  if (code.length === 8 && /^\d{8}$/.test(code)) {
    const ean8Result = validateEAN8(code);
    if (ean8Result.valid) {
      return { valid: true, format: 'EAN8' };
    }
  }

  // Accept as internal/CODE128 if alphanumeric
  if (/^[A-Za-z0-9\-]+$/.test(code) && code.length >= 3 && code.length <= 50) {
    return { valid: true, format: 'INTERNAL' };
  }

  return { valid: false, error: 'Formato de código de barras inválido' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VARIANT SKU GENERATOR
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Generate variant SKU from base product SKU and attributes
 */
export function generateVariantSKU(
  baseSku: string,
  attributes: Record<string, string>,
  separator: string = '-'
): string {
  const attributeCodes: string[] = [];

  // Sort attribute keys for consistency
  const sortedKeys = Object.keys(attributes).sort();

  for (const key of sortedKeys) {
    const value = attributes[key];
    // Take first 2 chars of value, uppercase
    const code = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 2);
    if (code) {
      attributeCodes.push(code);
    }
  }

  if (attributeCodes.length === 0) {
    return baseSku;
  }

  return `${baseSku}${separator}${attributeCodes.join('')}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SEQUENCE MANAGEMENT
// ═══════════════════════════════════════════════════════════════════════════════

// In-memory sequence cache (for development, use database in production)
const sequenceCache: Map<string, number> = new Map();

/**
 * Get next sequence number for an organization (mock implementation)
 * In production, this should be stored in the database
 */
export function createSequenceGetter(type: 'sku' | 'barcode') {
  return async (organizationId: string): Promise<number> => {
    const key = `${type}:${organizationId}`;
    const current = sequenceCache.get(key) || 0;
    const next = current + 1;
    sequenceCache.set(key, next);
    return next;
  };
}
