/**
 * White-Label Module
 * ==================
 *
 * Complete white-label customization system for customer portal.
 *
 * Features:
 * - Per-organization branding (logo, colors, fonts)
 * - Custom domain support with DNS verification
 * - Dynamic CSS generation
 * - Theme customization
 * - Email template customization
 *
 * Usage:
 * ```typescript
 * import {
 *   initializeBrandingService,
 *   initializeDomainService,
 *   createWhiteLabelPublicRoutes,
 *   createWhiteLabelAdminRoutes,
 * } from './whitelabel';
 *
 * // Initialize services
 * initializeBrandingService(pool);
 * initializeDomainService(pool);
 *
 * // Mount routes
 * app.use('/api/whitelabel', createWhiteLabelPublicRoutes(pool));
 * app.use('/api/admin/whitelabel', createWhiteLabelAdminRoutes(pool));
 * ```
 */

// Types
export * from './whitelabel.types';

// Branding Service
export {
  BrandingService,
  getBrandingService,
  initializeBrandingService,
  resetBrandingService,
} from './branding.service';

// Domain Service
export {
  DomainService,
  getDomainService,
  initializeDomainService,
  resetDomainService,
} from './domain.service';

// Routes
export {
  createWhiteLabelPublicRoutes,
  createWhiteLabelAdminRoutes,
} from './whitelabel.routes';

// Theme Generator
export {
  generateTheme,
  generateDarkTheme,
  generateCSSVariables,
  generateTailwindTheme,
  getBrandingConfig,
  saveBrandingConfig,
  generateOrganizationThemeCSS,
  hexToHSL,
  hslToHex,
  adjustLightness,
  getComplementaryColor,
  isLightColor,
} from './theme-generator';

export type {
  ThemeColors,
  ThemeTypography,
  ThemeSpacing,
  ThemeConfig,
  BrandingConfig,
} from './theme-generator';

// Email Templates
export {
  getEmailTemplate,
  saveEmailTemplate,
  resetEmailTemplate,
  renderEmailTemplate,
  getAllEmailTemplates,
} from './email-templates';

export type {
  EmailTemplateType,
  EmailTemplate,
  EmailTemplateInput,
  RenderContext,
} from './email-templates';

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION HELPER
// ═══════════════════════════════════════════════════════════════════════════════

import { Pool } from 'pg';
import { initializeBrandingService } from './branding.service';
import { initializeDomainService } from './domain.service';

/**
 * Initialize all white-label services
 */
export function initializeWhiteLabelServices(
  pool: Pool,
  options?: { cacheTTLMs?: number }
): void {
  initializeBrandingService(pool, options);
  initializeDomainService(pool, options);
  console.log('[WhiteLabel] Services initialized');
}
