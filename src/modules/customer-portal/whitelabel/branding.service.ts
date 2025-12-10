/**
 * Branding Service
 * ================
 *
 * Manages organization branding configuration.
 * Handles logo uploads, color schemes, and company info.
 */

import { Pool } from 'pg';
import {
  BrandingConfig,
  DEFAULT_BRANDING,
} from './whitelabel.types';

// ═══════════════════════════════════════════════════════════════════════════════
// BRANDING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class BrandingService {
  private pool: Pool;
  private cache: Map<string, { config: BrandingConfig; expiresAt: number }>;
  private cacheTTLMs: number;

  constructor(pool: Pool, options?: { cacheTTLMs?: number }) {
    this.pool = pool;
    this.cache = new Map();
    this.cacheTTLMs = options?.cacheTTLMs || 5 * 60 * 1000; // 5 minutes default
  }

  /**
   * Get branding config for an organization
   */
  async getBranding(orgId: string): Promise<BrandingConfig> {
    // Check cache
    const cached = this.cache.get(orgId);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.config;
    }

    // Query database
    const query = `
      SELECT
        o.id as org_id,
        o.name as company_name,
        COALESCE(wb.logo_url, o.logo_url) as logo_url,
        wb.logo_small_url,
        wb.favicon_url,
        COALESCE(wb.primary_color, '#0066CC') as primary_color,
        wb.primary_color_light,
        wb.primary_color_dark,
        wb.secondary_color,
        wb.accent_color,
        wb.text_color,
        wb.text_color_light,
        wb.background_color,
        wb.font_family,
        wb.heading_font_family,
        wb.tagline,
        wb.support_email,
        wb.support_phone,
        wb.support_whatsapp,
        wb.social_links,
        wb.welcome_message,
        wb.footer_text,
        wb.privacy_policy_url,
        wb.terms_of_service_url
      FROM organizations o
      LEFT JOIN whitelabel_branding wb ON o.id = wb.org_id
      WHERE o.id = $1
    `;

    const result = await this.pool.query(query, [orgId]);

    if (result.rows.length === 0) {
      throw new Error(`Organization not found: ${orgId}`);
    }

    const row = result.rows[0];
    const config = this.mapRowToBranding(row);

    // Cache result
    this.cache.set(orgId, {
      config,
      expiresAt: Date.now() + this.cacheTTLMs,
    });

    return config;
  }

  /**
   * Update branding configuration
   */
  async updateBranding(
    orgId: string,
    updates: Partial<BrandingConfig>
  ): Promise<BrandingConfig> {
    const client = await this.pool.connect();

    try {
      await client.query('BEGIN');

      // Upsert branding config
      await client.query(
        `
        INSERT INTO whitelabel_branding (
          org_id,
          logo_url,
          logo_small_url,
          favicon_url,
          primary_color,
          primary_color_light,
          primary_color_dark,
          secondary_color,
          accent_color,
          text_color,
          text_color_light,
          background_color,
          font_family,
          heading_font_family,
          tagline,
          support_email,
          support_phone,
          support_whatsapp,
          social_links,
          welcome_message,
          footer_text,
          privacy_policy_url,
          terms_of_service_url,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, NOW())
        ON CONFLICT (org_id)
        DO UPDATE SET
          logo_url = COALESCE(EXCLUDED.logo_url, whitelabel_branding.logo_url),
          logo_small_url = COALESCE(EXCLUDED.logo_small_url, whitelabel_branding.logo_small_url),
          favicon_url = COALESCE(EXCLUDED.favicon_url, whitelabel_branding.favicon_url),
          primary_color = COALESCE(EXCLUDED.primary_color, whitelabel_branding.primary_color),
          primary_color_light = COALESCE(EXCLUDED.primary_color_light, whitelabel_branding.primary_color_light),
          primary_color_dark = COALESCE(EXCLUDED.primary_color_dark, whitelabel_branding.primary_color_dark),
          secondary_color = COALESCE(EXCLUDED.secondary_color, whitelabel_branding.secondary_color),
          accent_color = COALESCE(EXCLUDED.accent_color, whitelabel_branding.accent_color),
          text_color = COALESCE(EXCLUDED.text_color, whitelabel_branding.text_color),
          text_color_light = COALESCE(EXCLUDED.text_color_light, whitelabel_branding.text_color_light),
          background_color = COALESCE(EXCLUDED.background_color, whitelabel_branding.background_color),
          font_family = COALESCE(EXCLUDED.font_family, whitelabel_branding.font_family),
          heading_font_family = COALESCE(EXCLUDED.heading_font_family, whitelabel_branding.heading_font_family),
          tagline = COALESCE(EXCLUDED.tagline, whitelabel_branding.tagline),
          support_email = COALESCE(EXCLUDED.support_email, whitelabel_branding.support_email),
          support_phone = COALESCE(EXCLUDED.support_phone, whitelabel_branding.support_phone),
          support_whatsapp = COALESCE(EXCLUDED.support_whatsapp, whitelabel_branding.support_whatsapp),
          social_links = COALESCE(EXCLUDED.social_links, whitelabel_branding.social_links),
          welcome_message = COALESCE(EXCLUDED.welcome_message, whitelabel_branding.welcome_message),
          footer_text = COALESCE(EXCLUDED.footer_text, whitelabel_branding.footer_text),
          privacy_policy_url = COALESCE(EXCLUDED.privacy_policy_url, whitelabel_branding.privacy_policy_url),
          terms_of_service_url = COALESCE(EXCLUDED.terms_of_service_url, whitelabel_branding.terms_of_service_url),
          updated_at = NOW()
        `,
        [
          orgId,
          updates.logoUrl || null,
          updates.logoSmallUrl || null,
          updates.faviconUrl || null,
          updates.primaryColor || null,
          updates.primaryColorLight || null,
          updates.primaryColorDark || null,
          updates.secondaryColor || null,
          updates.accentColor || null,
          updates.textColor || null,
          updates.textColorLight || null,
          updates.backgroundColor || null,
          updates.fontFamily || null,
          updates.headingFontFamily || null,
          updates.tagline || null,
          updates.supportEmail || null,
          updates.supportPhone || null,
          updates.supportWhatsApp || null,
          updates.socialLinks ? JSON.stringify(updates.socialLinks) : null,
          updates.welcomeMessage || null,
          updates.footerText || null,
          updates.privacyPolicyUrl || null,
          updates.termsOfServiceUrl || null,
        ]
      );

      await client.query('COMMIT');

      // Invalidate cache
      this.cache.delete(orgId);

      // Return updated config
      return this.getBranding(orgId);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Generate CSS variables from branding config
   */
  generateCSSVariables(branding: BrandingConfig): Record<string, string> {
    return {
      '--color-primary': branding.primaryColor,
      '--color-primary-light': branding.primaryColorLight || this.lightenColor(branding.primaryColor, 20),
      '--color-primary-dark': branding.primaryColorDark || this.darkenColor(branding.primaryColor, 20),
      '--color-secondary': branding.secondaryColor || DEFAULT_BRANDING.secondaryColor!,
      '--color-accent': branding.accentColor || DEFAULT_BRANDING.accentColor!,
      '--color-text': branding.textColor || DEFAULT_BRANDING.textColor!,
      '--color-text-light': branding.textColorLight || DEFAULT_BRANDING.textColorLight!,
      '--color-background': branding.backgroundColor || DEFAULT_BRANDING.backgroundColor!,
      '--font-family': branding.fontFamily || DEFAULT_BRANDING.fontFamily!,
      '--font-family-heading': branding.headingFontFamily || branding.fontFamily || DEFAULT_BRANDING.headingFontFamily!,
    };
  }

  /**
   * Generate complete CSS stylesheet
   */
  generateStylesheet(branding: BrandingConfig): string {
    const vars = this.generateCSSVariables(branding);

    return `
:root {
${Object.entries(vars).map(([key, value]) => `  ${key}: ${value};`).join('\n')}
}

/* Primary color utilities */
.text-primary { color: var(--color-primary); }
.bg-primary { background-color: var(--color-primary); }
.border-primary { border-color: var(--color-primary); }

.text-primary-light { color: var(--color-primary-light); }
.bg-primary-light { background-color: var(--color-primary-light); }

.text-primary-dark { color: var(--color-primary-dark); }
.bg-primary-dark { background-color: var(--color-primary-dark); }

/* Button styles */
.btn-primary {
  background-color: var(--color-primary);
  color: white;
}
.btn-primary:hover {
  background-color: var(--color-primary-dark);
}

/* Focus rings */
.focus-primary:focus {
  outline-color: var(--color-primary);
  box-shadow: 0 0 0 3px var(--color-primary-light);
}
`;
  }

  /**
   * Validate branding colors
   */
  validateBranding(branding: Partial<BrandingConfig>): string[] {
    const errors: string[] = [];

    if (branding.primaryColor && !this.isValidColor(branding.primaryColor)) {
      errors.push('primaryColor: Invalid color format');
    }
    if (branding.secondaryColor && !this.isValidColor(branding.secondaryColor)) {
      errors.push('secondaryColor: Invalid color format');
    }
    if (branding.accentColor && !this.isValidColor(branding.accentColor)) {
      errors.push('accentColor: Invalid color format');
    }

    // Validate URLs
    if (branding.logoUrl && !this.isValidUrl(branding.logoUrl)) {
      errors.push('logoUrl: Invalid URL format');
    }
    if (branding.privacyPolicyUrl && !this.isValidUrl(branding.privacyPolicyUrl)) {
      errors.push('privacyPolicyUrl: Invalid URL format');
    }

    return errors;
  }

  /**
   * Clear cache for an organization
   */
  clearCache(orgId: string): void {
    this.cache.delete(orgId);
  }

  /**
   * Clear all cache
   */
  clearAllCache(): void {
    this.cache.clear();
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  // PRIVATE HELPERS
  // ═══════════════════════════════════════════════════════════════════════════════

  private mapRowToBranding(row: any): BrandingConfig {
    return {
      orgId: row.org_id,
      companyName: row.company_name,
      tagline: row.tagline,
      logoUrl: row.logo_url,
      logoSmallUrl: row.logo_small_url,
      faviconUrl: row.favicon_url,
      primaryColor: row.primary_color || DEFAULT_BRANDING.primaryColor,
      primaryColorLight: row.primary_color_light,
      primaryColorDark: row.primary_color_dark,
      secondaryColor: row.secondary_color,
      accentColor: row.accent_color,
      textColor: row.text_color,
      textColorLight: row.text_color_light,
      backgroundColor: row.background_color,
      fontFamily: row.font_family,
      headingFontFamily: row.heading_font_family,
      supportEmail: row.support_email,
      supportPhone: row.support_phone,
      supportWhatsApp: row.support_whatsapp,
      socialLinks: row.social_links,
      welcomeMessage: row.welcome_message,
      footerText: row.footer_text,
      privacyPolicyUrl: row.privacy_policy_url,
      termsOfServiceUrl: row.terms_of_service_url,
    };
  }

  private isValidColor(color: string): boolean {
    // Check hex format
    if (/^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/.test(color)) {
      return true;
    }
    // Check rgb/rgba format
    if (/^rgba?\(.+\)$/.test(color)) {
      return true;
    }
    // Check hsl/hsla format
    if (/^hsla?\(.+\)$/.test(color)) {
      return true;
    }
    return false;
  }

  private isValidUrl(url: string): boolean {
    try {
      new URL(url);
      return true;
    } catch {
      return false;
    }
  }

  private lightenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.min(255, (num >> 16) + Math.round(2.55 * percent));
    const g = Math.min(255, ((num >> 8) & 0x00ff) + Math.round(2.55 * percent));
    const b = Math.min(255, (num & 0x0000ff) + Math.round(2.55 * percent));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  private darkenColor(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const r = Math.max(0, (num >> 16) - Math.round(2.55 * percent));
    const g = Math.max(0, ((num >> 8) & 0x00ff) - Math.round(2.55 * percent));
    const b = Math.max(0, (num & 0x0000ff) - Math.round(2.55 * percent));
    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let brandingServiceInstance: BrandingService | null = null;

export function getBrandingService(): BrandingService {
  if (!brandingServiceInstance) {
    throw new Error('BrandingService not initialized');
  }
  return brandingServiceInstance;
}

export function initializeBrandingService(
  pool: Pool,
  options?: { cacheTTLMs?: number }
): BrandingService {
  brandingServiceInstance = new BrandingService(pool, options);
  return brandingServiceInstance;
}

export function resetBrandingService(): void {
  brandingServiceInstance = null;
}
