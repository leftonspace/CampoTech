/**
 * Customer Authentication Service
 * ================================
 *
 * Main authentication service for the customer portal.
 * Orchestrates magic link, OTP, and session management.
 */

import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import {
  AuthenticatedCustomer,
  CustomerAuthResult,
  CustomerAuthContext,
  CustomerDeviceInfo,
  MagicLinkMetadata,
  ImpersonationSession,
  StartImpersonationRequest,
  CustomerAuthErrorCode,
  CustomerAuthRepository,
  CustomerSessionDatabaseAdapter,
  MagicLinkDatabaseAdapter,
  CustomerOTPDatabaseAdapter,
  ImpersonationDatabaseAdapter,
  CustomerEmailProvider,
  CustomerSMSProvider,
  CreateCustomerFromAuth,
} from './customer-auth.types';
import { MagicLinkService, MagicLinkError } from './magic-link.service';
import { CustomerOTPService, CustomerOTPError } from './customer-otp.service';
import { CustomerSessionService, CustomerSessionError, CustomerSecretProvider } from './customer-session.service';

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer auth service error
 */
export class CustomerAuthError extends Error {
  code: CustomerAuthErrorCode;
  httpStatus: number;

  constructor(code: CustomerAuthErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'CustomerAuthError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// ORGANIZATION REPOSITORY
// ═══════════════════════════════════════════════════════════════════════════════

export interface OrganizationRepository {
  getOrganizationById(id: string): Promise<{ id: string; name: string } | null>;
  getOrganizationByDomain(domain: string): Promise<{ id: string; name: string } | null>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer Authentication Service
 *
 * Provides:
 * - Magic link authentication (primary method)
 * - Phone OTP authentication (secondary method)
 * - Session management
 * - Account linking (phone <-> email)
 * - Support impersonation ("Login as customer")
 */
export class CustomerAuthService {
  private pool: Pool;
  private magicLinkService: MagicLinkService;
  private otpService: CustomerOTPService;
  private sessionService: CustomerSessionService;
  private customerRepository: CustomerAuthRepository;
  private orgRepository: OrganizationRepository;
  private impersonationAdapter?: ImpersonationDatabaseAdapter;

  constructor(
    pool: Pool,
    magicLinkService: MagicLinkService,
    otpService: CustomerOTPService,
    sessionService: CustomerSessionService,
    customerRepository: CustomerAuthRepository,
    orgRepository: OrganizationRepository,
    impersonationAdapter?: ImpersonationDatabaseAdapter
  ) {
    this.pool = pool;
    this.magicLinkService = magicLinkService;
    this.otpService = otpService;
    this.sessionService = sessionService;
    this.customerRepository = customerRepository;
    this.orgRepository = orgRepository;
    this.impersonationAdapter = impersonationAdapter;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // MAGIC LINK AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Request a magic link to be sent to customer email
   */
  async requestMagicLink(
    orgId: string,
    email: string,
    metadata?: MagicLinkMetadata
  ): Promise<{ expiresAt: Date; email: string }> {
    // Get organization
    const org = await this.orgRepository.getOrganizationById(orgId);
    if (!org) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.CUSTOMER_ORG_MISMATCH,
        'Organization not found'
      );
    }

    // Check if customer exists
    const existingCustomer = await this.customerRepository.getCustomerByEmail(orgId, email);

    return this.magicLinkService.sendMagicLink(
      { email, orgId, metadata },
      org.name,
      existingCustomer?.id
    );
  }

  /**
   * Verify magic link and authenticate customer
   */
  async authenticateWithMagicLink(
    token: string,
    deviceInfo?: CustomerDeviceInfo,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CustomerAuthResult> {
    // Verify magic link
    const magicLink = await this.magicLinkService.verifyMagicLink(token);

    // Get or create customer
    let customer = await this.customerRepository.getCustomerByEmail(
      magicLink.orgId,
      magicLink.email
    );

    let isNewCustomer = false;

    if (!customer) {
      // Create new customer from email
      customer = await this.customerRepository.createCustomer(magicLink.orgId, {
        email: magicLink.email,
        fullName: magicLink.email.split('@')[0], // Use email prefix as initial name
      });
      isNewCustomer = true;
      console.log(`[CustomerAuth] Created new customer from magic link: ${customer.id.slice(0, 8)}...`);
    }

    // Create session
    const result = await this.sessionService.createSession(
      customer,
      deviceInfo,
      ipAddress,
      userAgent
    );

    return {
      ...result,
      isNewCustomer,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OTP AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Request OTP to be sent to customer phone
   */
  async requestOTP(
    orgId: string,
    phone: string
  ): Promise<{ expiresAt: Date; phone: string }> {
    // Get organization
    const org = await this.orgRepository.getOrganizationById(orgId);
    if (!org) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.CUSTOMER_ORG_MISMATCH,
        'Organization not found'
      );
    }

    // Check if customer exists
    const existingCustomer = await this.customerRepository.getCustomerByPhone(orgId, phone);

    return this.otpService.sendOTP(
      { phone, orgId },
      org.name,
      existingCustomer?.id
    );
  }

  /**
   * Verify OTP and authenticate customer
   */
  async authenticateWithOTP(
    orgId: string,
    phone: string,
    code: string,
    deviceInfo?: CustomerDeviceInfo,
    ipAddress?: string,
    userAgent?: string
  ): Promise<CustomerAuthResult> {
    // Verify OTP
    const otp = await this.otpService.verifyOTP({ phone, code, orgId });

    // Get or create customer
    let customer = await this.customerRepository.getCustomerByPhone(orgId, phone);

    let isNewCustomer = false;

    if (!customer) {
      // Create new customer from phone
      customer = await this.customerRepository.createCustomer(orgId, {
        phone,
      });
      isNewCustomer = true;
      console.log(`[CustomerAuth] Created new customer from OTP: ${customer.id.slice(0, 8)}...`);
    }

    // Create session
    const result = await this.sessionService.createSession(
      customer,
      deviceInfo,
      ipAddress,
      userAgent
    );

    return {
      ...result,
      isNewCustomer,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<CustomerAuthContext> {
    return this.sessionService.validateAccessToken(accessToken);
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string) {
    return this.sessionService.refreshTokens(refreshToken);
  }

  /**
   * Logout current session
   */
  async logout(refreshToken: string): Promise<void> {
    return this.sessionService.logout(refreshToken);
  }

  /**
   * Logout from all devices
   */
  async logoutAllDevices(customerId: string): Promise<void> {
    return this.sessionService.logoutAllDevices(customerId);
  }

  /**
   * Get active sessions for customer
   */
  async getActiveSessions(customerId: string) {
    return this.sessionService.getActiveSessions(customerId);
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string, reason: string): Promise<void> {
    return this.sessionService.revokeSession(sessionId, reason);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ACCOUNT LINKING
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Link phone to existing customer account
   * Requires verification via OTP
   */
  async linkPhone(
    customerId: string,
    orgId: string,
    phone: string
  ): Promise<{ expiresAt: Date; phone: string }> {
    // Verify customer exists
    const customer = await this.customerRepository.getCustomerById(orgId, customerId);
    if (!customer) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found'
      );
    }

    // Check if phone already linked to another customer
    const existingByPhone = await this.customerRepository.getCustomerByPhone(orgId, phone);
    if (existingByPhone && existingByPhone.id !== customerId) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.LINK_ALREADY_EXISTS,
        'This phone number is already linked to another account'
      );
    }

    // Get org for OTP message
    const org = await this.orgRepository.getOrganizationById(orgId);

    // Send OTP for verification
    return this.otpService.sendOTP({ phone, orgId }, org?.name || 'CampoTech', customerId);
  }

  /**
   * Verify phone link OTP and update customer
   */
  async verifyPhoneLink(
    customerId: string,
    orgId: string,
    phone: string,
    code: string
  ): Promise<void> {
    // Verify OTP
    await this.otpService.verifyOTP({ phone, code, orgId });

    // Update customer phone
    await this.customerRepository.updateCustomerPhone(customerId, phone);

    console.log(`[CustomerAuth] Phone linked for customer ${customerId.slice(0, 8)}...`);
  }

  /**
   * Link email to existing customer account
   * Requires verification via magic link
   */
  async linkEmail(
    customerId: string,
    orgId: string,
    email: string
  ): Promise<{ expiresAt: Date; email: string }> {
    // Verify customer exists
    const customer = await this.customerRepository.getCustomerById(orgId, customerId);
    if (!customer) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found'
      );
    }

    // Check if email already linked to another customer
    const existingByEmail = await this.customerRepository.getCustomerByEmail(orgId, email);
    if (existingByEmail && existingByEmail.id !== customerId) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.LINK_ALREADY_EXISTS,
        'This email is already linked to another account'
      );
    }

    // Get org for email message
    const org = await this.orgRepository.getOrganizationById(orgId);

    // Send magic link for verification
    return this.magicLinkService.sendMagicLink(
      {
        email,
        orgId,
        metadata: { context: 'account_link' },
      },
      org?.name || 'CampoTech',
      customerId
    );
  }

  /**
   * Verify email link and update customer
   * Called when customer clicks the magic link
   */
  async verifyEmailLink(token: string): Promise<void> {
    // Verify magic link
    const magicLink = await this.magicLinkService.verifyMagicLink(token);

    // Ensure this is an account link context
    if (magicLink.metadata?.context !== 'account_link') {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.LINK_VERIFICATION_FAILED,
        'Invalid link for account linking'
      );
    }

    if (!magicLink.customerId) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.LINK_VERIFICATION_FAILED,
        'No customer associated with this link'
      );
    }

    // Update customer email
    await this.customerRepository.updateCustomerEmail(magicLink.customerId, magicLink.email);

    console.log(`[CustomerAuth] Email linked for customer ${magicLink.customerId.slice(0, 8)}...`);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // IMPERSONATION (Support "Login as customer")
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Start impersonation session (support agent viewing as customer)
   * Requires proper authorization check before calling this method
   */
  async startImpersonation(
    supportUserId: string,
    request: StartImpersonationRequest,
    orgId: string
  ): Promise<{ session: ImpersonationSession; tokens: any }> {
    if (!this.impersonationAdapter) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.IMPERSONATION_NOT_ALLOWED,
        'Impersonation is not configured'
      );
    }

    // Check if support user already has an active impersonation session
    const existingSession = await this.impersonationAdapter.getActiveImpersonationSession(supportUserId);
    if (existingSession) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.IMPERSONATION_NOT_ALLOWED,
        'You already have an active impersonation session. Please end it first.'
      );
    }

    // Get customer
    const customer = await this.customerRepository.getCustomerById(orgId, request.customerId);
    if (!customer) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found'
      );
    }

    // Create impersonation session (1 hour expiry)
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
    const impersonationSession = await this.impersonationAdapter.createImpersonationSession({
      supportUserId,
      customerId: request.customerId,
      orgId,
      reason: request.reason,
      startedAt: new Date(),
      expiresAt,
      actionsPerformed: [],
    });

    // Generate tokens for customer view
    const tokens = await this.sessionService.generateTokenPair(customer);

    console.log(
      `[CustomerAuth] Support user ${supportUserId.slice(0, 8)}... started impersonating ` +
      `customer ${request.customerId.slice(0, 8)}... Reason: ${request.reason}`
    );

    return {
      session: impersonationSession,
      tokens,
    };
  }

  /**
   * End impersonation session
   */
  async endImpersonation(supportUserId: string): Promise<void> {
    if (!this.impersonationAdapter) {
      return;
    }

    const session = await this.impersonationAdapter.getActiveImpersonationSession(supportUserId);
    if (session) {
      await this.impersonationAdapter.endImpersonationSession(session.id);
      console.log(
        `[CustomerAuth] Support user ${supportUserId.slice(0, 8)}... ended impersonation of ` +
        `customer ${session.customerId.slice(0, 8)}...`
      );
    }
  }

  /**
   * Log action during impersonation (for audit trail)
   */
  async logImpersonationAction(sessionId: string, action: string): Promise<void> {
    if (this.impersonationAdapter) {
      await this.impersonationAdapter.logImpersonationAction(sessionId, action);
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CONTEXTUAL LINKS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Create a magic link for specific context (e.g., invoice viewing, job tracking)
   */
  async createContextualLink(
    orgId: string,
    customerId: string,
    context: 'invoice' | 'job_tracking' | 'booking' | 'support',
    entityId: string
  ): Promise<string> {
    // Get customer and org
    const customer = await this.customerRepository.getCustomerById(orgId, customerId);
    if (!customer || !customer.email) {
      throw new CustomerAuthError(
        CustomerAuthErrorCode.CUSTOMER_NOT_FOUND,
        'Customer not found or has no email'
      );
    }

    const org = await this.orgRepository.getOrganizationById(orgId);

    return this.magicLinkService.createContextualMagicLink(
      orgId,
      customer.email,
      customerId,
      context,
      entityId,
      org?.name || 'CampoTech'
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Cleanup expired sessions, magic links, and OTPs
   */
  async cleanup(): Promise<void> {
    await Promise.all([
      this.sessionService.cleanup(),
      this.magicLinkService.cleanup(),
      this.otpService.cleanup(),
    ]);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: CustomerAuthService | null = null;

export function getCustomerAuthService(): CustomerAuthService {
  if (!instance) {
    throw new Error('CustomerAuthService not initialized');
  }
  return instance;
}

export function initializeCustomerAuthService(
  pool: Pool,
  magicLinkService: MagicLinkService,
  otpService: CustomerOTPService,
  sessionService: CustomerSessionService,
  customerRepository: CustomerAuthRepository,
  orgRepository: OrganizationRepository,
  impersonationAdapter?: ImpersonationDatabaseAdapter
): CustomerAuthService {
  instance = new CustomerAuthService(
    pool,
    magicLinkService,
    otpService,
    sessionService,
    customerRepository,
    orgRepository,
    impersonationAdapter
  );
  return instance;
}

export function resetCustomerAuthService(): void {
  instance = null;
}

// Re-export error classes
export { MagicLinkError, CustomerOTPError, CustomerSessionError };
