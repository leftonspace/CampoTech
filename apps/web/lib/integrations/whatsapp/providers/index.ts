/**
 * WhatsApp BSP Providers Module
 * =============================
 *
 * Abstraction layer for multiple WhatsApp Business Solution Providers.
 *
 * Supported Providers:
 * - META_DIRECT: Organization's own Meta Business credentials (manual setup)
 * - DIALOG_360: 360dialog partner integration (CampoTech-provisioned numbers)
 * - TWILIO: Twilio WhatsApp (future)
 *
 * Usage:
 *   import { getBSPProvider, createProviderForOrg } from '@/lib/integrations/whatsapp/providers';
 *
 *   // Get provider for an organization
 *   const provider = await createProviderForOrg(organizationId);
 *   await provider.sendMessage(orgId, { to: '...', type: 'text', content: { body: 'Hello' } });
 */

// Export all types
export * from './types';

// Export providers
export { MetaDirectProvider } from './meta-direct.provider';
// export { Dialog360Provider } from './dialog360.provider'; // Phase 3
// export { TwilioProvider } from './twilio.provider'; // Future

import type {
  WhatsAppBSPProvider,
  BSPProviderType,
  MetaDirectConfig,
  Dialog360Config,
} from './types';
import { MetaDirectProvider } from './meta-direct.provider';

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a BSP provider instance based on configuration
 */
export function createBSPProvider(
  type: BSPProviderType,
  config: MetaDirectConfig | Dialog360Config
): WhatsAppBSPProvider {
  switch (type) {
    case 'META_DIRECT':
      return new MetaDirectProvider(config as MetaDirectConfig);

    case 'DIALOG_360':
      // Will be implemented in Phase 3
      throw new Error('360dialog provider not yet implemented');

    case 'TWILIO':
      // Future implementation
      throw new Error('Twilio provider not yet implemented');

    default:
      throw new Error(`Unknown BSP provider type: ${type}`);
  }
}

/**
 * Create a BSP provider for a specific organization
 * Fetches the organization's WhatsApp configuration from the database
 */
export async function createProviderForOrg(
  organizationId: string
): Promise<WhatsAppBSPProvider | null> {
  const { prisma } = await import('@/lib/prisma');

  // Fetch organization's WhatsApp configuration
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: {
      whatsappIntegrationType: true,
      whatsappPhoneNumberId: true,
      whatsappBusinessAccountId: true,
      whatsappAccessToken: true,
      whatsappAppSecret: true,
      whatsappWebhookVerifyToken: true,
      whatsappBusinessAccount: {
        select: {
          phoneNumberId: true,
          businessAccountId: true,
          accessToken: true,
          webhookVerifyToken: true,
          webhookSecret: true,
          bspProvider: true,
          bspAccountId: true,
        },
      },
    },
  });

  if (!org) {
    console.error(`[BSP] Organization ${organizationId} not found`);
    return null;
  }

  // Determine which provider to use
  const bspProvider = org.whatsappBusinessAccount?.bspProvider || 'META_DIRECT';

  // Check if we have valid configuration for the provider
  if (bspProvider === 'META_DIRECT') {
    // Use organization-level credentials first, then fall back to WhatsAppBusinessAccount
    const phoneNumberId = org.whatsappPhoneNumberId || org.whatsappBusinessAccount?.phoneNumberId;
    const accessToken = org.whatsappAccessToken || org.whatsappBusinessAccount?.accessToken;

    if (!phoneNumberId || !accessToken) {
      console.warn(`[BSP] Organization ${organizationId} has no Meta Direct credentials configured`);
      return null;
    }

    return new MetaDirectProvider({
      phoneNumberId,
      businessAccountId: org.whatsappBusinessAccountId || org.whatsappBusinessAccount?.businessAccountId || undefined,
      accessToken,
      appSecret: org.whatsappAppSecret || undefined,
      webhookVerifyToken: org.whatsappWebhookVerifyToken || org.whatsappBusinessAccount?.webhookVerifyToken || undefined,
    });
  }

  if (bspProvider === 'DIALOG_360') {
    // Will be implemented in Phase 3
    console.warn(`[BSP] 360dialog provider not yet implemented`);
    return null;
  }

  console.warn(`[BSP] Unknown provider type: ${bspProvider}`);
  return null;
}

/**
 * Get a BSP provider using environment variables (for global operations)
 * This is a fallback for when we don't have organization-specific credentials
 */
export function getDefaultBSPProvider(): WhatsAppBSPProvider | null {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;

  if (!phoneNumberId || !accessToken) {
    return null;
  }

  return new MetaDirectProvider({
    phoneNumberId,
    accessToken,
    businessAccountId: process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    appSecret: process.env.WHATSAPP_APP_SECRET,
    webhookVerifyToken: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// PROVIDER REGISTRY (for runtime provider management)
// ═══════════════════════════════════════════════════════════════════════════════

const providerCache = new Map<string, WhatsAppBSPProvider>();

/**
 * Get or create a cached provider for an organization
 */
export async function getOrCreateProviderForOrg(
  organizationId: string
): Promise<WhatsAppBSPProvider | null> {
  // Check cache first
  const cached = providerCache.get(organizationId);
  if (cached) {
    return cached;
  }

  // Create new provider
  const provider = await createProviderForOrg(organizationId);
  if (provider) {
    providerCache.set(organizationId, provider);
  }

  return provider;
}

/**
 * Clear cached provider for an organization
 * (Call this when organization's WhatsApp settings change)
 */
export function clearProviderCache(organizationId: string): void {
  providerCache.delete(organizationId);
}

/**
 * Clear all cached providers
 */
export function clearAllProviderCache(): void {
  providerCache.clear();
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Check if an organization has WhatsApp BSP configured
 */
export async function hasProviderConfigured(organizationId: string): Promise<boolean> {
  const provider = await createProviderForOrg(organizationId);
  return provider !== null;
}

/**
 * Get the provider type for an organization
 */
export async function getProviderType(organizationId: string): Promise<BSPProviderType | null> {
  const { prisma } = await import('@/lib/prisma');

  const account = await prisma.whatsAppBusinessAccount.findUnique({
    where: { organizationId },
    select: { bspProvider: true },
  });

  return (account?.bspProvider as BSPProviderType) || null;
}

/**
 * Get provider capabilities
 */
export function getProviderCapabilities(type: BSPProviderType): {
  supportsProvisioning: boolean;
  supportsTemplates: boolean;
  supportsInteractive: boolean;
  supportsMedia: boolean;
} {
  switch (type) {
    case 'META_DIRECT':
      return {
        supportsProvisioning: false, // Manual setup only
        supportsTemplates: true,
        supportsInteractive: true,
        supportsMedia: true,
      };
    case 'DIALOG_360':
      return {
        supportsProvisioning: true, // Can provision numbers via API
        supportsTemplates: true,
        supportsInteractive: true,
        supportsMedia: true,
      };
    case 'TWILIO':
      return {
        supportsProvisioning: true,
        supportsTemplates: true,
        supportsInteractive: false, // Limited support
        supportsMedia: true,
      };
    default:
      return {
        supportsProvisioning: false,
        supportsTemplates: false,
        supportsInteractive: false,
        supportsMedia: false,
      };
  }
}
