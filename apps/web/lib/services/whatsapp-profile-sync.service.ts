/**
 * WhatsApp Profile Sync Service
 * ==============================
 *
 * Syncs CampoTech verification badges to WhatsApp Business Profile.
 * Updates the WhatsApp business description to include earned badges,
 * making verifications visible to customers in WhatsApp.
 *
 * Badge Format in Description:
 * "Plomería Méndez | ✓ CUIT Verificado | ✓ Asegurado | ✓ Gasista Matriculado
 *  Servicio profesional de plomería..."
 */

import { prisma } from '@/lib/prisma';
import { Dialog360Provider } from '@/lib/integrations/whatsapp/providers/dialog360.provider';

// Badge emoji/icon mappings for WhatsApp display
const BADGE_ICONS: Record<string, string> = {
  // Core verifications
  cuitVerified: '✓',
  insuranceVerified: '🛡️',
  backgroundCheck: '✓',
  professionalLicense: '📋',
  // Optional badges (by code)
  gasista_matriculado: '🔥',
  electricista_matriculado: '⚡',
  plomero_matriculado: '🔧',
  seguro_rc: '🛡️',
  antecedentes_penales: '✓',
  art_vigente: '🏗️',
  habilitacion_municipal: '🏛️',
  monotributo_al_dia: '📄',
  flota_asegurada: '🚗',
  herramientas_certificadas: '🔧',
  tecnico_refrigeracion: '❄️',
};

// Badge labels for WhatsApp display (shorter versions)
const BADGE_LABELS: Record<string, string> = {
  cuitVerified: 'CUIT Verificado',
  insuranceVerified: 'Asegurado',
  backgroundCheck: 'Antecedentes OK',
  professionalLicense: 'Matriculado',
  gasista_matriculado: 'Gasista',
  electricista_matriculado: 'Electricista',
  plomero_matriculado: 'Plomero',
  seguro_rc: 'RC Asegurado',
  antecedentes_penales: 'Antecedentes OK',
  art_vigente: 'ART Vigente',
  habilitacion_municipal: 'Habilitado',
  monotributo_al_dia: 'Monotributo OK',
  flota_asegurada: 'Flota Asegurada',
  herramientas_certificadas: 'Herramientas OK',
  tecnico_refrigeracion: 'Refrigeración',
};

interface OptionalBadge {
  code: string;
  icon?: string;
  label?: string;
}

class WhatsAppProfileSyncService {
  private provider: Dialog360Provider | null = null;

  /**
   * Get or create the Dialog360 provider
   */
  private getProvider(): Dialog360Provider {
    if (!this.provider) {
      this.provider = new Dialog360Provider({
        apiKey: process.env.DIALOG360_PARTNER_API_KEY || '',
        partnerId: process.env.DIALOG360_PARTNER_ID || '',
        webhookSecret: process.env.DIALOG360_WEBHOOK_SECRET,
      });
    }
    return this.provider;
  }

  /**
   * Build badge text for WhatsApp description
   * Format: "✓ CUIT Verificado | 🛡️ Asegurado | 🔥 Gasista"
   */
  buildBadgeText(
    coreVerifications: {
      cuitVerified: boolean;
      insuranceVerified: boolean;
      backgroundCheck: boolean;
      professionalLicense: boolean;
    },
    optionalBadges: OptionalBadge[]
  ): string {
    const badges: string[] = [];

    // Add core verifications
    if (coreVerifications.cuitVerified) {
      badges.push(`${BADGE_ICONS.cuitVerified} ${BADGE_LABELS.cuitVerified}`);
    }
    if (coreVerifications.insuranceVerified) {
      badges.push(`${BADGE_ICONS.insuranceVerified} ${BADGE_LABELS.insuranceVerified}`);
    }
    if (coreVerifications.backgroundCheck) {
      badges.push(`${BADGE_ICONS.backgroundCheck} ${BADGE_LABELS.backgroundCheck}`);
    }

    // Add optional badges (limit to avoid exceeding character limits)
    const maxOptionalBadges = 3; // Keep description concise
    const sortedBadges = optionalBadges.slice(0, maxOptionalBadges);

    for (const badge of sortedBadges) {
      const icon = BADGE_ICONS[badge.code] || '✓';
      const label = BADGE_LABELS[badge.code] || badge.label || badge.code;
      badges.push(`${icon} ${label}`);
    }

    return badges.join(' | ');
  }

  /**
   * Build the full WhatsApp description with badges
   * Max 512 chars, but recommended 256 for best display
   */
  buildDescription(
    businessName: string,
    originalDescription: string | null,
    badgeText: string
  ): string {
    const maxLength = 256; // Recommended for good display

    // If no badges, return original description
    if (!badgeText) {
      return originalDescription?.slice(0, maxLength) || '';
    }

    // Format: "Business Name | Badges\nDescription..."
    const header = badgeText ? `${businessName} | ${badgeText}` : businessName;

    if (!originalDescription) {
      return header.slice(0, maxLength);
    }

    // Calculate remaining space for description
    const remainingSpace = maxLength - header.length - 2; // -2 for newline

    if (remainingSpace <= 20) {
      // Not enough space for description, just use header
      return header.slice(0, maxLength);
    }

    const truncatedDesc = originalDescription.slice(0, remainingSpace);
    return `${header}\n${truncatedDesc}`;
  }

  /**
   * Sync badges to WhatsApp Business Profile
   */
  async syncBadgesToWhatsApp(organizationId: string): Promise<{
    success: boolean;
    error?: string;
    skipped?: boolean;
    reason?: string;
  }> {
    try {
      // Check if organization has WhatsApp BSP integration
      const account = await prisma.whatsAppBusinessAccount.findUnique({
        where: { organizationId },
        select: {
          provisioningStatus: true,
          bspProvider: true,
        },
      });

      // Skip if no BSP account or not active
      if (!account) {
        return {
          success: true,
          skipped: true,
          reason: 'No WhatsApp BSP account configured',
        };
      }

      if (account.provisioningStatus !== 'ACTIVE' && account.provisioningStatus !== 'VERIFIED') {
        return {
          success: true,
          skipped: true,
          reason: `WhatsApp account status: ${account.provisioningStatus}`,
        };
      }

      // Only support Dialog360 for now
      if (account.bspProvider !== 'DIALOG_360') {
        return {
          success: true,
          skipped: true,
          reason: `BSP provider ${account.bspProvider} not supported for profile sync`,
        };
      }

      // Get organization and public profile data
      const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: {
          name: true,
          publicProfile: {
            select: {
              displayName: true,
              description: true,
              cuitVerified: true,
              insuranceVerified: true,
              backgroundCheck: true,
              professionalLicense: true,
              optionalBadges: true,
            },
          },
        },
      });

      if (!org) {
        return { success: false, error: 'Organization not found' };
      }

      const profile = org.publicProfile;
      if (!profile) {
        return {
          success: true,
          skipped: true,
          reason: 'No public profile configured',
        };
      }

      // Parse optional badges
      let optionalBadges: OptionalBadge[] = [];
      if (profile.optionalBadges) {
        if (typeof profile.optionalBadges === 'string') {
          optionalBadges = JSON.parse(profile.optionalBadges);
        } else if (Array.isArray(profile.optionalBadges)) {
          optionalBadges = profile.optionalBadges as OptionalBadge[];
        }
      }

      // Build badge text
      const badgeText = this.buildBadgeText(
        {
          cuitVerified: profile.cuitVerified,
          insuranceVerified: profile.insuranceVerified,
          backgroundCheck: profile.backgroundCheck,
          professionalLicense: profile.professionalLicense,
        },
        optionalBadges
      );

      // Skip if no badges to display
      if (!badgeText) {
        return {
          success: true,
          skipped: true,
          reason: 'No badges to display',
        };
      }

      // Build the full description
      const businessName = profile.displayName || org.name;
      const newDescription = this.buildDescription(
        businessName,
        profile.description,
        badgeText
      );

      // Update WhatsApp profile
      const provider = this.getProvider();
      const result = await provider.updateBusinessProfile(organizationId, {
        description: newDescription,
      });

      if (!result.success) {
        console.error(`[WhatsAppProfileSync] Failed to sync badges for org ${organizationId}:`, result.error);
        return { success: false, error: result.error };
      }

      console.log(`[WhatsAppProfileSync] Successfully synced badges to WhatsApp for org ${organizationId}`);
      console.log(`[WhatsAppProfileSync] New description: ${newDescription}`);

      return { success: true };
    } catch (error) {
      console.error('[WhatsAppProfileSync] Error syncing badges:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Build "about" text with key badge (max 139 chars)
   * Format: "✓ Verificado en CampoTech | CUIT OK | Asegurado"
   */
  buildAboutText(
    coreVerifications: {
      cuitVerified: boolean;
      insuranceVerified: boolean;
    }
  ): string {
    const parts: string[] = ['✓ Verificado en CampoTech'];

    if (coreVerifications.cuitVerified) {
      parts.push('CUIT OK');
    }
    if (coreVerifications.insuranceVerified) {
      parts.push('Asegurado');
    }

    const result = parts.join(' | ');
    return result.slice(0, 139);
  }

  /**
   * Full sync including about text
   */
  async fullSync(organizationId: string): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Get profile data
      const profile = await prisma.businessPublicProfile.findUnique({
        where: { organizationId },
        select: {
          displayName: true,
          description: true,
          cuitVerified: true,
          insuranceVerified: true,
          backgroundCheck: true,
          professionalLicense: true,
          optionalBadges: true,
        },
      });

      if (!profile) {
        return { success: true }; // No profile, nothing to sync
      }

      // Parse optional badges
      let optionalBadges: OptionalBadge[] = [];
      if (profile.optionalBadges) {
        if (typeof profile.optionalBadges === 'string') {
          optionalBadges = JSON.parse(profile.optionalBadges);
        } else if (Array.isArray(profile.optionalBadges)) {
          optionalBadges = profile.optionalBadges as OptionalBadge[];
        }
      }

      // Build texts
      const badgeText = this.buildBadgeText(
        {
          cuitVerified: profile.cuitVerified,
          insuranceVerified: profile.insuranceVerified,
          backgroundCheck: profile.backgroundCheck,
          professionalLicense: profile.professionalLicense,
        },
        optionalBadges
      );

      const newDescription = this.buildDescription(
        profile.displayName,
        profile.description,
        badgeText
      );

      const aboutText = this.buildAboutText({
        cuitVerified: profile.cuitVerified,
        insuranceVerified: profile.insuranceVerified,
      });

      // Update WhatsApp profile
      const provider = this.getProvider();
      const result = await provider.updateBusinessProfile(organizationId, {
        description: newDescription,
        about: aboutText,
      });

      return result;
    } catch (error) {
      console.error('[WhatsAppProfileSync] Error in full sync:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }
}

// Export singleton instance
export const whatsAppProfileSync = new WhatsAppProfileSyncService();
