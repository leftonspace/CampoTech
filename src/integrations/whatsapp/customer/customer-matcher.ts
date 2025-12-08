/**
 * WhatsApp Customer Matcher
 * =========================
 *
 * Matches incoming WhatsApp phone numbers to customers in the database.
 * Handles Argentine phone number normalization.
 */

import { db } from '../../../lib/db';
import { log } from '../../../lib/logging/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MatchedCustomer {
  id: string;
  organizationId: string;
  name: string;
  phone: string;
  email?: string;
  dni?: string;
}

export interface CustomerMatchResult {
  found: true;
  customer: MatchedCustomer;
  organization: {
    id: string;
    name: string;
    waPhoneNumberId?: string;
  };
}

export interface CustomerNotFoundResult {
  found: false;
  normalizedPhone: string;
  possibleVariants: string[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE NUMBER NORMALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Normalize phone number to standard format
 * Handles Argentine phone numbers with various formats
 */
export function normalizePhoneNumber(phone: string): string {
  // Remove all non-digits
  let digits = phone.replace(/\D/g, '');

  // Handle WhatsApp format (may have leading zeros)
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  // If it's a 10-digit Argentine number (without country code)
  if (digits.length === 10 && !digits.startsWith('54')) {
    digits = '54' + digits;
  }

  // If it's 11 digits starting with 15 (old mobile format)
  if (digits.length === 11 && digits.startsWith('15')) {
    digits = '549' + digits.slice(2);
  }

  // Normalize 54XX to 549XX (add mobile prefix if missing)
  if (digits.startsWith('54') && !digits.startsWith('549') && digits.length === 12) {
    digits = '549' + digits.slice(2);
  }

  return digits;
}

/**
 * Generate possible phone number variants for matching
 * Since phone storage formats vary, we try multiple variants
 */
export function generatePhoneVariants(phone: string): string[] {
  const normalized = normalizePhoneNumber(phone);
  const variants: Set<string> = new Set();

  variants.add(normalized);

  // Without country code (10 digits)
  if (normalized.startsWith('549') && normalized.length === 13) {
    variants.add(normalized.slice(3)); // Remove 549
  }

  // With 54 but without 9
  if (normalized.startsWith('549')) {
    variants.add('54' + normalized.slice(3));
  }

  // With leading 15 (old format)
  if (normalized.startsWith('549') && normalized.length === 13) {
    variants.add('15' + normalized.slice(5));
  }

  // With dashes and spaces (common storage formats)
  const local = normalized.slice(-10);
  variants.add(local);
  variants.add(`${local.slice(0, 4)}-${local.slice(4)}`);
  variants.add(`${local.slice(0, 4)} ${local.slice(4)}`);

  return Array.from(variants);
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER MATCHING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Find customer by WhatsApp phone number
 */
export async function findCustomerByPhone(
  waPhone: string
): Promise<CustomerMatchResult | CustomerNotFoundResult> {
  const normalized = normalizePhoneNumber(waPhone);
  const variants = generatePhoneVariants(waPhone);

  log.debug('Searching for customer by phone', {
    original: waPhone,
    normalized,
    variantCount: variants.length,
  });

  try {
    // Search across all variants
    const customer = await db.customer.findFirst({
      where: {
        OR: variants.map((v) => ({
          phone: {
            contains: v,
          },
        })),
        deletedAt: null,
      },
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            settings: true,
          },
        },
      },
    });

    if (!customer) {
      log.info('Customer not found for phone', { phone: normalized });
      return {
        found: false,
        normalizedPhone: normalized,
        possibleVariants: variants,
      };
    }

    log.info('Customer found', {
      customerId: customer.id,
      organizationId: customer.organizationId,
      phone: normalized,
    });

    // Extract WA phone number ID from organization settings
    const settings = customer.organization.settings as Record<string, unknown> | null;
    const waPhoneNumberId = settings?.whatsappPhoneNumberId as string | undefined;

    return {
      found: true,
      customer: {
        id: customer.id,
        organizationId: customer.organizationId,
        name: customer.name,
        phone: customer.phone,
        email: customer.email || undefined,
        dni: customer.dni || undefined,
      },
      organization: {
        id: customer.organization.id,
        name: customer.organization.name,
        waPhoneNumberId,
      },
    };
  } catch (error) {
    log.error('Error finding customer by phone', {
      phone: normalized,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {
      found: false,
      normalizedPhone: normalized,
      possibleVariants: variants,
    };
  }
}

/**
 * Find or create customer from WhatsApp contact
 */
export async function findOrCreateCustomer(
  organizationId: string,
  waPhone: string,
  profileName?: string
): Promise<MatchedCustomer> {
  const normalized = normalizePhoneNumber(waPhone);
  const variants = generatePhoneVariants(waPhone);

  // First try to find existing customer
  const existing = await db.customer.findFirst({
    where: {
      organizationId,
      OR: variants.map((v) => ({
        phone: { contains: v },
      })),
      deletedAt: null,
    },
  });

  if (existing) {
    return {
      id: existing.id,
      organizationId: existing.organizationId,
      name: existing.name,
      phone: existing.phone,
      email: existing.email || undefined,
      dni: existing.dni || undefined,
    };
  }

  // Create new customer
  log.info('Creating new customer from WhatsApp', {
    organizationId,
    phone: normalized,
    profileName,
  });

  const newCustomer = await db.customer.create({
    data: {
      organizationId,
      name: profileName || `WhatsApp ${normalized.slice(-4)}`,
      phone: normalized,
      source: 'whatsapp',
    },
  });

  return {
    id: newCustomer.id,
    organizationId: newCustomer.organizationId,
    name: newCustomer.name,
    phone: newCustomer.phone,
    email: undefined,
    dni: undefined,
  };
}

/**
 * Get organization's WhatsApp configuration
 */
export async function getOrganizationWAConfig(
  organizationId: string
): Promise<{
  phoneNumberId: string;
  accessToken: string;
  businessAccountId: string;
} | null> {
  const org = await db.organization.findUnique({
    where: { id: organizationId },
    select: { settings: true },
  });

  if (!org?.settings) return null;

  const settings = org.settings as Record<string, unknown>;
  const phoneNumberId = settings.whatsappPhoneNumberId as string | undefined;
  const accessToken = settings.whatsappAccessToken as string | undefined;
  const businessAccountId = settings.whatsappBusinessAccountId as string | undefined;

  if (!phoneNumberId || !accessToken || !businessAccountId) {
    return null;
  }

  return { phoneNumberId, accessToken, businessAccountId };
}

/**
 * Update customer's last WhatsApp interaction
 */
export async function updateCustomerLastInteraction(
  customerId: string,
  timestamp: Date = new Date()
): Promise<void> {
  await db.customer.update({
    where: { id: customerId },
    data: {
      lastContactAt: timestamp,
      metadata: {
        update: {
          lastWhatsAppMessage: timestamp.toISOString(),
        },
      },
    },
  });
}
