/**
 * Customer Portal Module
 * ======================
 *
 * Complete customer self-service portal system for CampoTech.
 *
 * Phase 13: Customer Self-Service Portal
 *
 * Sub-modules:
 * - 13.1 Authentication: Magic links, OTP, session management
 * - 13.2 Backend APIs: Booking, history, payments, support
 * - 13.4 Real-Time Tracking: WebSocket, ETA, technician location
 * - 13.6 White-Label: Branding, custom domains, themes
 *
 * The Customer Portal Web App (13.3 & 13.5) is in /apps/customer-portal/
 *
 * Usage:
 * ```typescript
 * import {
 *   initializeCustomerPortal,
 *   createAllCustomerPortalRoutes,
 * } from './customer-portal';
 *
 * // Initialize all services
 * await initializeCustomerPortal(pool, {
 *   portalBaseUrl: 'https://portal.example.com',
 *   jwtSecret: process.env.CUSTOMER_JWT_SECRET,
 *   emailConfig: { ... },
 *   smsConfig: { ... },
 *   wsPort: 3001,
 *   googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY,
 * });
 *
 * // Mount all routes
 * const routes = createAllCustomerPortalRoutes(pool);
 * app.use('/customer/auth', routes.auth);
 * app.use('/customer/portal', routes.portal);
 * app.use('/customer/tracking', routes.tracking);
 * app.use('/api/whitelabel', routes.whiteLabelPublic);
 * ```
 */

import { Pool } from 'pg';
import { Router } from 'express';

// ═══════════════════════════════════════════════════════════════════════════════
// RE-EXPORTS
// ═══════════════════════════════════════════════════════════════════════════════

// Auth module (13.1)
export * from './auth';

// Booking module (13.2)
export * from './booking';

// History module (13.2)
export * from './history';

// Payments module (13.2)
export * from './payments';

// Communication module (13.2)
export * from './communication';

// Portal service (13.2)
export * from './portal.service';

// Portal routes (13.2)
export { createCustomerPortalRoutes } from './portal.routes';

// Tracking module (13.4)
export * from './tracking';

// White-label module (13.6)
export * from './whitelabel';

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerPortalConfig {
  portalBaseUrl: string;
  jwtSecret: string;
  emailConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: { user: string; pass: string };
    from: string;
  };
  smsConfig?: {
    type: 'twilio' | 'whatsapp' | 'mock';
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
  };
  wsPort?: number;
  googleMapsApiKey?: string;
  cacheTTLMs?: number;
}

/**
 * Initialize all customer portal services
 */
export async function initializeCustomerPortal(
  pool: Pool,
  config: CustomerPortalConfig
): Promise<void> {
  console.log('[CustomerPortal] Initializing...');

  // Initialize auth
  const { initializeCustomerAuth } = await import('./auth');
  await initializeCustomerAuth(pool, {
    portalBaseUrl: config.portalBaseUrl,
    jwtSecret: config.jwtSecret,
    emailConfig: config.emailConfig,
    smsConfig: config.smsConfig,
  });

  // Initialize portal service
  const { initializePortalService } = await import('./portal.service');
  initializePortalService(pool);

  // Initialize tracking
  const { initializeTrackingService } = await import('./tracking');
  initializeTrackingService(pool, {
    googleMapsApiKey: config.googleMapsApiKey,
    wsPort: config.wsPort,
    jwtSecret: config.jwtSecret,
  });

  // Initialize white-label
  const { initializeWhiteLabelServices } = await import('./whitelabel');
  initializeWhiteLabelServices(pool, { cacheTTLMs: config.cacheTTLMs });

  console.log('[CustomerPortal] Initialization complete');
}

/**
 * Create all customer portal routes
 */
export function createAllCustomerPortalRoutes(pool: Pool): {
  auth: Router;
  portal: Router;
  tracking: Router;
  whiteLabelPublic: Router;
  whiteLabelAdmin: Router;
  technicianTracking: Router;
} {
  const { createCustomerAuthRoutes } = require('./auth');
  const { createCustomerPortalRoutes } = require('./portal.routes');
  const { createTrackingRoutes, createTechnicianTrackingRoutes } = require('./tracking');
  const { createWhiteLabelPublicRoutes, createWhiteLabelAdminRoutes } = require('./whitelabel');

  return {
    auth: createCustomerAuthRoutes(pool),
    portal: createCustomerPortalRoutes(pool),
    tracking: createTrackingRoutes(pool),
    whiteLabelPublic: createWhiteLabelPublicRoutes(pool),
    whiteLabelAdmin: createWhiteLabelAdminRoutes(pool),
    technicianTracking: createTechnicianTrackingRoutes(pool),
  };
}

/**
 * Get all migration file paths for customer portal
 */
export function getCustomerPortalMigrations(): string[] {
  return [
    '019_create_customer_portal_auth.sql',
    '020_create_customer_portal_tables.sql',
    '021_create_tracking_tables.sql',
    '022_create_whitelabel_tables.sql',
  ];
}
