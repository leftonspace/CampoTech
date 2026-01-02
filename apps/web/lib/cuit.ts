/**
 * CUIT Validation Utility
 * =======================
 *
 * Validates Argentine CUIT (Clave Unica de Identificacion Tributaria)
 * Format: XX-XXXXXXXX-X (11 digits total)
 *
 * First 2 digits: Type identifier
 * - 20, 23, 24, 27: Persona fisica (individual)
 * - 30, 33, 34: Persona juridica (company)
 *
 * Middle 8 digits: DNI or company number
 * Last digit: Verification digit (calculated with mod 11)
 */

// Valid CUIT type prefixes
const VALID_PREFIXES = ['20', '23', '24', '27', '30', '33', '34'];

// Multipliers for verification digit calculation (mod 11)
const MULTIPLIERS = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

export interface CUITValidationResult {
  valid: boolean;
  error?: string;
  formatted?: string;
  type?: 'persona_fisica' | 'persona_juridica';
  digits?: string;
}

/**
 * Validates an Argentine CUIT number
 * @param cuit - CUIT string (can include dashes or spaces)
 * @returns Validation result with formatted CUIT if valid
 */
export function validateCUIT(cuit: string): CUITValidationResult {
  // Clean the input - remove all non-digits
  const digits = cuit.replace(/\D/g, '');

  // Check length
  if (digits.length !== 11) {
    return {
      valid: false,
      error: 'El CUIT debe tener 11 digitos',
    };
  }

  // Check prefix
  const prefix = digits.slice(0, 2);
  if (!VALID_PREFIXES.includes(prefix)) {
    return {
      valid: false,
      error: 'El tipo de CUIT no es valido (debe comenzar con 20, 23, 24, 27, 30, 33 o 34)',
    };
  }

  // Calculate verification digit
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(digits[i]) * MULTIPLIERS[i];
  }

  const remainder = sum % 11;
  const calculatedVerifier = remainder === 0 ? 0 : 11 - remainder;

  // Special case: if calculated verifier is 11, it becomes 0
  const finalVerifier = calculatedVerifier === 11 ? 0 : calculatedVerifier;

  // Get the actual verification digit from input
  const actualVerifier = parseInt(digits[10]);

  if (finalVerifier !== actualVerifier) {
    return {
      valid: false,
      error: 'El digito verificador del CUIT es incorrecto',
    };
  }

  // Determine type
  const type: 'persona_fisica' | 'persona_juridica' =
    ['20', '23', '24', '27'].includes(prefix) ? 'persona_fisica' : 'persona_juridica';

  // Format as XX-XXXXXXXX-X
  const formatted = `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;

  return {
    valid: true,
    formatted,
    type,
    digits,
  };
}

/**
 * Formats a CUIT string to XX-XXXXXXXX-X format
 * @param cuit - CUIT string (any format)
 * @returns Formatted CUIT or original if invalid
 */
export function formatCUIT(cuit: string): string {
  const digits = cuit.replace(/\D/g, '').slice(0, 11);

  if (digits.length <= 2) return digits;
  if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
  return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
}

/**
 * Check if organization with this CUIT already exists
 * This is used during registration to prevent duplicates
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function checkCUITExists(cuit: string, prisma: any): Promise<boolean> {
  const digits = cuit.replace(/\D/g, '');

  const existing = await prisma.organization.findFirst({
    where: {
      settings: {
        path: ['cuit'],
        equals: digits,
      },
    },
  });

  return !!existing;
}
