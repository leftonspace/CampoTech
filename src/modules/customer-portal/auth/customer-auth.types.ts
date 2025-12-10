/**
 * Customer Authentication Types
 * =============================
 *
 * Type definitions for the customer portal authentication system.
 * Customers authenticate separately from internal users (technicians, dispatchers, etc.)
 */

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER SESSION & TOKENS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer JWT payload (different from internal user tokens)
 */
export interface CustomerJWTPayload {
  sub: string;           // Customer ID
  orgId: string;         // Organization ID
  type: 'customer';      // Token type discriminator
  email?: string;        // Customer email (for display)
  phone?: string;        // Customer phone
  iat: number;           // Issued at
  exp: number;           // Expires at
  jti: string;           // JWT ID (for revocation)
}

/**
 * Customer session
 */
export interface CustomerSession {
  id: string;
  customerId: string;
  orgId: string;
  deviceInfo?: CustomerDeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  refreshTokenHash: string;
  isActive: boolean;
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Customer device information
 */
export interface CustomerDeviceInfo {
  platform?: string;     // web, ios, android
  os?: string;           // Operating system
  browser?: string;      // Browser name
  deviceId?: string;     // Unique device identifier
  pushToken?: string;    // Push notification token
}

/**
 * Customer token pair
 */
export interface CustomerTokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;       // Access token TTL in seconds
  tokenType: 'Bearer';
}

/**
 * Authenticated customer info
 */
export interface AuthenticatedCustomer {
  id: string;
  orgId: string;
  fullName: string;
  phone: string;
  email?: string;
}

/**
 * Customer auth result
 */
export interface CustomerAuthResult {
  customer: AuthenticatedCustomer;
  tokens: CustomerTokenPair;
  session: CustomerSession;
  isNewCustomer: boolean;
}

/**
 * Customer auth context (set per request)
 */
export interface CustomerAuthContext {
  customerId: string;
  orgId: string;
  sessionId: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAGIC LINK
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Magic link record
 */
export interface MagicLink {
  id: string;
  orgId: string;
  customerId?: string;     // If existing customer
  email: string;
  tokenHash: string;
  used: boolean;
  usedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
  metadata?: MagicLinkMetadata;
}

/**
 * Magic link metadata
 */
export interface MagicLinkMetadata {
  returnTo?: string;       // URL to redirect after login
  context?: string;        // e.g., 'booking', 'invoice_view', 'support'
  invoiceId?: string;      // For invoice-specific links
  jobId?: string;          // For job-specific links
}

/**
 * Send magic link request
 */
export interface SendMagicLinkRequest {
  email: string;
  orgId: string;
  metadata?: MagicLinkMetadata;
}

/**
 * Verify magic link request
 */
export interface VerifyMagicLinkRequest {
  token: string;
  deviceInfo?: CustomerDeviceInfo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CUSTOMER OTP
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer OTP record
 */
export interface CustomerOTP {
  id: string;
  orgId: string;
  customerId?: string;     // If existing customer
  phone: string;
  codeHash: string;
  attempts: number;
  verified: boolean;
  verifiedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

/**
 * Send customer OTP request
 */
export interface SendCustomerOTPRequest {
  phone: string;
  orgId: string;
}

/**
 * Verify customer OTP request
 */
export interface VerifyCustomerOTPRequest {
  phone: string;
  code: string;
  orgId: string;
  deviceInfo?: CustomerDeviceInfo;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ACCOUNT LINKING
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Account link request (e.g., linking phone to email)
 */
export interface AccountLinkRequest {
  customerId: string;
  linkType: 'phone_to_email' | 'email_to_phone';
  email?: string;
  phone?: string;
}

/**
 * Account link verification
 */
export interface AccountLinkVerification {
  id: string;
  customerId: string;
  linkType: 'phone_to_email' | 'email_to_phone';
  verificationMethod: 'otp' | 'magic_link';
  verified: boolean;
  verifiedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// IMPERSONATION (Support "Login as customer")
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Impersonation session (support agent viewing as customer)
 */
export interface ImpersonationSession {
  id: string;
  supportUserId: string;   // Internal user ID
  customerId: string;      // Customer being impersonated
  orgId: string;
  reason: string;          // Required reason for audit
  startedAt: Date;
  expiresAt: Date;
  endedAt?: Date;
  actionsPerformed: string[];  // Audit trail
}

/**
 * Start impersonation request
 */
export interface StartImpersonationRequest {
  customerId: string;
  reason: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CODES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer auth error codes
 */
export enum CustomerAuthErrorCode {
  // Magic Link errors
  MAGIC_LINK_EXPIRED = 'CAUTH_001',
  MAGIC_LINK_USED = 'CAUTH_002',
  MAGIC_LINK_INVALID = 'CAUTH_003',
  MAGIC_LINK_RATE_LIMITED = 'CAUTH_004',

  // OTP errors
  OTP_EXPIRED = 'CAUTH_010',
  OTP_INVALID = 'CAUTH_011',
  OTP_TOO_MANY_ATTEMPTS = 'CAUTH_012',
  OTP_RATE_LIMITED = 'CAUTH_013',

  // Session errors
  SESSION_EXPIRED = 'CAUTH_020',
  SESSION_REVOKED = 'CAUTH_021',
  SESSION_INVALID = 'CAUTH_022',

  // Token errors
  TOKEN_EXPIRED = 'CAUTH_030',
  TOKEN_INVALID = 'CAUTH_031',
  TOKEN_REVOKED = 'CAUTH_032',

  // Customer errors
  CUSTOMER_NOT_FOUND = 'CAUTH_040',
  CUSTOMER_INACTIVE = 'CAUTH_041',
  CUSTOMER_ORG_MISMATCH = 'CAUTH_042',

  // Account linking errors
  LINK_ALREADY_EXISTS = 'CAUTH_050',
  LINK_VERIFICATION_FAILED = 'CAUTH_051',

  // Impersonation errors
  IMPERSONATION_NOT_ALLOWED = 'CAUTH_060',
  IMPERSONATION_EXPIRED = 'CAUTH_061',
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATABASE ADAPTERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Magic link database adapter
 */
export interface MagicLinkDatabaseAdapter {
  createMagicLink(link: Omit<MagicLink, 'id' | 'createdAt'>): Promise<MagicLink>;
  getMagicLinkByTokenHash(tokenHash: string): Promise<MagicLink | null>;
  markMagicLinkUsed(id: string): Promise<void>;
  cleanupExpiredMagicLinks(): Promise<void>;
  countRecentMagicLinks(email: string, windowMinutes: number): Promise<number>;
}

/**
 * Customer OTP database adapter
 */
export interface CustomerOTPDatabaseAdapter {
  createOTP(otp: Omit<CustomerOTP, 'id' | 'createdAt'>): Promise<CustomerOTP>;
  getLatestOTP(orgId: string, phone: string): Promise<CustomerOTP | null>;
  incrementAttempts(id: string): Promise<void>;
  markVerified(id: string): Promise<void>;
  cleanupExpiredOTPs(): Promise<void>;
  countRecentOTPs(phone: string, windowMinutes: number): Promise<number>;
}

/**
 * Customer session database adapter
 */
export interface CustomerSessionDatabaseAdapter {
  createSession(session: Omit<CustomerSession, 'id' | 'createdAt'>): Promise<CustomerSession>;
  getSessionById(id: string): Promise<CustomerSession | null>;
  getSessionByRefreshTokenHash(hash: string): Promise<CustomerSession | null>;
  updateSessionLastUsed(id: string): Promise<void>;
  revokeSession(id: string, reason: string): Promise<void>;
  revokeAllCustomerSessions(customerId: string, reason: string): Promise<void>;
  getActiveSessionsForCustomer(customerId: string): Promise<CustomerSession[]>;
  cleanupExpiredSessions(): Promise<void>;
}

/**
 * Impersonation database adapter
 */
export interface ImpersonationDatabaseAdapter {
  createImpersonationSession(session: Omit<ImpersonationSession, 'id'>): Promise<ImpersonationSession>;
  getActiveImpersonationSession(supportUserId: string): Promise<ImpersonationSession | null>;
  endImpersonationSession(id: string): Promise<void>;
  logImpersonationAction(sessionId: string, action: string): Promise<void>;
}

/**
 * Customer repository interface for auth
 */
export interface CustomerAuthRepository {
  getCustomerById(orgId: string, id: string): Promise<AuthenticatedCustomer | null>;
  getCustomerByEmail(orgId: string, email: string): Promise<AuthenticatedCustomer | null>;
  getCustomerByPhone(orgId: string, phone: string): Promise<AuthenticatedCustomer | null>;
  createCustomer(orgId: string, data: CreateCustomerFromAuth): Promise<AuthenticatedCustomer>;
  updateCustomerEmail(customerId: string, email: string): Promise<void>;
  updateCustomerPhone(customerId: string, phone: string): Promise<void>;
  updateLastLoginAt(customerId: string): Promise<void>;
}

/**
 * Create customer from auth data
 */
export interface CreateCustomerFromAuth {
  fullName?: string;
  phone?: string;
  email?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// EMAIL/SMS PROVIDERS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Email provider interface for magic links
 */
export interface CustomerEmailProvider {
  sendMagicLinkEmail(
    email: string,
    magicLinkUrl: string,
    orgName: string,
    expiresInMinutes: number
  ): Promise<boolean>;
}

/**
 * SMS provider interface for OTP
 */
export interface CustomerSMSProvider {
  sendOTP(phone: string, code: string, orgName: string): Promise<boolean>;
}
