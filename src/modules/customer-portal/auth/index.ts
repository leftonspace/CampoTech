/**
 * Customer Portal Authentication Module
 * ======================================
 *
 * Complete authentication system for the customer portal.
 *
 * Features:
 * - Magic link (email-based) authentication
 * - Phone OTP authentication
 * - Session management with refresh tokens
 * - Account linking (phone <-> email)
 * - Support impersonation ("Login as customer")
 *
 * Usage:
 * ```typescript
 * import { initializeCustomerAuth, createCustomerAuthRoutes } from './customer-portal/auth';
 *
 * // Initialize the auth system
 * initializeCustomerAuth(pool, {
 *   portalBaseUrl: 'https://portal.example.com',
 *   jwtSecret: process.env.CUSTOMER_JWT_SECRET,
 *   emailConfig: { ... },
 *   smsConfig: { ... },
 * });
 *
 * // Mount routes
 * app.use('/customer/auth', createCustomerAuthRoutes(pool));
 * ```
 */

import { Pool } from 'pg';

// Types
export * from './customer-auth.types';

// Services
export {
  CustomerAuthService,
  getCustomerAuthService,
  initializeCustomerAuthService,
  resetCustomerAuthService,
} from './customer-auth.service';
export type {
  CustomerAuthError,
  MagicLinkError,
  CustomerOTPError,
  CustomerSessionError,
} from './customer-auth.service';

export {
  MagicLinkService,
  getMagicLinkService,
  resetMagicLinkService,
} from './magic-link.service';

export {
  CustomerOTPService,
  getCustomerOTPService,
  resetCustomerOTPService,
} from './customer-otp.service';

export {
  CustomerSessionService,
  getCustomerSessionService,
  resetCustomerSessionService,
} from './customer-session.service';
export type { CustomerSecretProvider } from './customer-session.service';

// Middleware
export {
  requireCustomerAuth,
  optionalCustomerAuth,
  requireCustomerOrg,
  authRateLimit,
  auditCustomerAction,
  customerAuthErrorHandler,
} from './customer-auth.middleware';

// Routes
export { createCustomerAuthRoutes } from './customer-auth.routes';

// Adapters
export {
  PostgresMagicLinkAdapter,
  PostgresCustomerOTPAdapter,
  PostgresCustomerSessionAdapter,
  PostgresImpersonationAdapter,
  PostgresCustomerAuthRepository,
  createMagicLinkAdapter,
  createCustomerOTPAdapter,
  createCustomerSessionAdapter,
  createImpersonationAdapter,
  createCustomerAuthRepository,
} from './adapters/database.adapters';

export {
  NodemailerEmailProvider,
  TwilioSMSProvider,
  WhatsAppOTPProvider,
  MockEmailProvider,
  MockSMSProvider,
  createEmailProvider,
  createSMSProvider,
} from './adapters/providers.adapters';
export type {
  EmailConfig,
  TwilioConfig,
  WhatsAppConfig,
} from './adapters/providers.adapters';

// ═══════════════════════════════════════════════════════════════════════════════
// INITIALIZATION
// ═══════════════════════════════════════════════════════════════════════════════

export interface CustomerAuthConfig {
  portalBaseUrl: string;
  jwtSecret: string;
  emailConfig?: {
    host: string;
    port: number;
    secure: boolean;
    auth: {
      user: string;
      pass: string;
    };
    from: string;
  };
  smsConfig?: {
    type: 'twilio' | 'whatsapp' | 'mock';
    accountSid?: string;
    authToken?: string;
    fromNumber?: string;
    apiUrl?: string;
    accessToken?: string;
    phoneNumberId?: string;
  };
}

/**
 * Initialize the customer authentication system
 */
export async function initializeCustomerAuth(
  pool: Pool,
  config: CustomerAuthConfig
): Promise<void> {
  const {
    createMagicLinkAdapter,
    createCustomerOTPAdapter,
    createCustomerSessionAdapter,
    createImpersonationAdapter,
    createCustomerAuthRepository,
  } = await import('./adapters/database.adapters');

  const {
    createEmailProvider,
    createSMSProvider,
  } = await import('./adapters/providers.adapters');

  const { getMagicLinkService } = await import('./magic-link.service');
  const { getCustomerOTPService } = await import('./customer-otp.service');
  const { getCustomerSessionService } = await import('./customer-session.service');
  const { initializeCustomerAuthService } = await import('./customer-auth.service');

  // Create adapters
  const magicLinkAdapter = createMagicLinkAdapter(pool);
  const otpAdapter = createCustomerOTPAdapter(pool);
  const sessionAdapter = createCustomerSessionAdapter(pool);
  const impersonationAdapter = createImpersonationAdapter(pool);
  const customerRepository = createCustomerAuthRepository(pool);

  // Create providers
  const emailProvider = createEmailProvider(config.emailConfig);
  const smsProvider = createSMSProvider(
    config.smsConfig?.type || 'mock',
    config.smsConfig
  );

  // Create secret provider
  const secretProvider = {
    getCustomerJWTSecret: async () => config.jwtSecret,
  };

  // Create org repository (simplified)
  const orgRepository = {
    getOrganizationById: async (id: string) => {
      const result = await pool.query(
        'SELECT id, name FROM organizations WHERE id = $1',
        [id]
      );
      return result.rows[0] || null;
    },
    getOrganizationByDomain: async (domain: string) => {
      const result = await pool.query(
        'SELECT id, name FROM organizations WHERE custom_domain = $1',
        [domain]
      );
      return result.rows[0] || null;
    },
  };

  // Initialize services
  const magicLinkService = getMagicLinkService(
    magicLinkAdapter,
    emailProvider,
    config.portalBaseUrl
  );

  const otpService = getCustomerOTPService(otpAdapter, smsProvider);

  const sessionService = getCustomerSessionService(
    sessionAdapter,
    customerRepository,
    secretProvider
  );

  initializeCustomerAuthService(
    pool,
    magicLinkService,
    otpService,
    sessionService,
    customerRepository,
    orgRepository,
    impersonationAdapter
  );

  console.log('[CustomerAuth] Authentication system initialized');
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE MIGRATIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * SQL migration for customer portal auth tables
 */
export const CUSTOMER_AUTH_MIGRATION = `
-- Customer Magic Links
CREATE TABLE IF NOT EXISTS customer_magic_links (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID REFERENCES customers(id),
  email VARCHAR(255) NOT NULL,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  used BOOLEAN DEFAULT FALSE,
  used_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_magic_links_token_hash ON customer_magic_links(token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_magic_links_email ON customer_magic_links(email, created_at);

-- Customer OTP Codes
CREATE TABLE IF NOT EXISTS customer_otp_codes (
  id UUID PRIMARY KEY,
  org_id UUID NOT NULL REFERENCES organizations(id),
  customer_id UUID REFERENCES customers(id),
  phone VARCHAR(20) NOT NULL,
  code_hash TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  verified BOOLEAN DEFAULT FALSE,
  verified_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_otp_codes_phone ON customer_otp_codes(org_id, phone, created_at);

-- Customer Sessions
CREATE TABLE IF NOT EXISTS customer_sessions (
  id UUID PRIMARY KEY,
  customer_id UUID NOT NULL REFERENCES customers(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  device_info JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  refresh_token_hash VARCHAR(64) NOT NULL UNIQUE,
  is_active BOOLEAN DEFAULT TRUE,
  last_used_at TIMESTAMPTZ DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  revocation_reason VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_sessions_refresh_token ON customer_sessions(refresh_token_hash);
CREATE INDEX IF NOT EXISTS idx_customer_sessions_customer ON customer_sessions(customer_id, is_active);

-- Customer Impersonation Sessions (for support)
CREATE TABLE IF NOT EXISTS customer_impersonation_sessions (
  id UUID PRIMARY KEY,
  support_user_id UUID NOT NULL REFERENCES users(id),
  customer_id UUID NOT NULL REFERENCES customers(id),
  org_id UUID NOT NULL REFERENCES organizations(id),
  reason TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  ended_at TIMESTAMPTZ,
  actions_performed JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_impersonation_support_user ON customer_impersonation_sessions(support_user_id, ended_at);

-- Add last_login_at to customers if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'customers' AND column_name = 'last_login_at'
  ) THEN
    ALTER TABLE customers ADD COLUMN last_login_at TIMESTAMPTZ;
  END IF;
END $$;
`;
