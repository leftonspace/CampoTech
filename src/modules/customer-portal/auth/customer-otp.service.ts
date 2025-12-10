/**
 * Customer OTP Service
 * ====================
 *
 * Handles phone-based OTP authentication for customers.
 * Secondary authentication method for customers who prefer SMS.
 */

import * as crypto from 'crypto';
import { promisify } from 'util';
import {
  CustomerOTP,
  SendCustomerOTPRequest,
  VerifyCustomerOTPRequest,
  CustomerOTPDatabaseAdapter,
  CustomerSMSProvider,
  CustomerAuthErrorCode,
} from './customer-auth.types';

// Promisify scrypt for async usage
const scryptAsync = promisify(crypto.scrypt);

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_OTPS_PER_WINDOW = 5;

// Scrypt parameters (OWASP recommendations)
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;
const SCRYPT_R = 8;
const SCRYPT_P = 1;

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer OTP specific error
 */
export class CustomerOTPError extends Error {
  code: CustomerAuthErrorCode;
  httpStatus: number;

  constructor(code: CustomerAuthErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'CustomerOTPError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Customer OTP Service class
 */
export class CustomerOTPService {
  private dbAdapter: CustomerOTPDatabaseAdapter;
  private smsProvider: CustomerSMSProvider;

  constructor(
    dbAdapter: CustomerOTPDatabaseAdapter,
    smsProvider: CustomerSMSProvider
  ) {
    this.dbAdapter = dbAdapter;
    this.smsProvider = smsProvider;
  }

  /**
   * Generate a random OTP code
   */
  private generateCode(): string {
    const min = Math.pow(10, OTP_LENGTH - 1);
    const max = Math.pow(10, OTP_LENGTH) - 1;
    const code = crypto.randomInt(min, max).toString();
    return code.padStart(OTP_LENGTH, '0');
  }

  /**
   * Hash OTP code for storage using scrypt
   * Format: salt$hash (both hex encoded)
   */
  private async hashCode(code: string): Promise<string> {
    const salt = crypto.randomBytes(SCRYPT_SALT_LENGTH);
    const hash = await scryptAsync(code, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    }) as Buffer;
    return `${salt.toString('hex')}$${hash.toString('hex')}`;
  }

  /**
   * Verify OTP code against stored hash using constant-time comparison
   */
  private async verifyHash(code: string, storedHash: string): Promise<boolean> {
    const [saltHex, hashHex] = storedHash.split('$');
    if (!saltHex || !hashHex) {
      return false;
    }

    const salt = Buffer.from(saltHex, 'hex');
    const expectedHash = Buffer.from(hashHex, 'hex');

    const actualHash = await scryptAsync(code, salt, SCRYPT_KEY_LENGTH, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
    }) as Buffer;

    // Use timing-safe comparison to prevent timing attacks
    if (actualHash.length !== expectedHash.length) {
      return false;
    }
    return crypto.timingSafeEqual(actualHash, expectedHash);
  }

  /**
   * Normalize phone number to E.164 format (Argentine phones)
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digit characters
    let cleaned = phone.replace(/\D/g, '');

    // Handle Argentine numbers
    if (cleaned.startsWith('54')) {
      // Already has country code
    } else if (cleaned.startsWith('9')) {
      // Mobile with 9 prefix
      cleaned = '54' + cleaned;
    } else if (cleaned.length === 10) {
      // 10-digit local number
      cleaned = '549' + cleaned;
    } else if (cleaned.length === 11 && cleaned.startsWith('15')) {
      // Old format with 15 prefix
      cleaned = '549' + cleaned.slice(2);
    }

    return '+' + cleaned;
  }

  /**
   * Validate phone number format
   */
  private validatePhone(phone: string): boolean {
    const normalized = this.normalizePhone(phone);
    // Argentine mobile numbers should be +549XXXXXXXXXX (13 digits)
    return /^\+549\d{10}$/.test(normalized);
  }

  /**
   * Send OTP to customer phone
   */
  async sendOTP(
    request: SendCustomerOTPRequest,
    orgName: string,
    customerId?: string
  ): Promise<{ expiresAt: Date; phone: string }> {
    const normalizedPhone = this.normalizePhone(request.phone);

    // Validate phone format
    if (!this.validatePhone(request.phone)) {
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_INVALID,
        'Invalid phone number format'
      );
    }

    // Check rate limiting
    const recentCount = await this.dbAdapter.countRecentOTPs(
      normalizedPhone,
      RATE_LIMIT_WINDOW_MINUTES
    );

    if (recentCount >= MAX_OTPS_PER_WINDOW) {
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_RATE_LIMITED,
        'Too many OTP requests. Please try again later.',
        429
      );
    }

    // Generate OTP
    const code = this.generateCode();
    const codeHash = await this.hashCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Store OTP
    await this.dbAdapter.createOTP({
      orgId: request.orgId,
      customerId,
      phone: normalizedPhone,
      codeHash,
      attempts: 0,
      verified: false,
      expiresAt,
    });

    // Send SMS
    const sent = await this.smsProvider.sendOTP(normalizedPhone, code, orgName);

    if (!sent) {
      console.error(`[CustomerOTP] Failed to send OTP to ${normalizedPhone.slice(-4)}`);
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_INVALID,
        'Failed to send OTP. Please try again.',
        500
      );
    }

    console.log(`[CustomerOTP] Sent OTP to ***${normalizedPhone.slice(-4)}`);

    return {
      expiresAt,
      phone: normalizedPhone,
    };
  }

  /**
   * Verify customer OTP code
   */
  async verifyOTP(request: VerifyCustomerOTPRequest): Promise<CustomerOTP> {
    const normalizedPhone = this.normalizePhone(request.phone);

    // Get latest OTP for this phone in this org
    const otp = await this.dbAdapter.getLatestOTP(request.orgId, normalizedPhone);

    if (!otp) {
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_INVALID,
        'No OTP found for this phone number'
      );
    }

    // Check if expired
    if (new Date() > otp.expiresAt) {
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_EXPIRED,
        'OTP has expired. Please request a new one.'
      );
    }

    // Check if already verified
    if (otp.verified) {
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_INVALID,
        'OTP has already been used. Please request a new one.'
      );
    }

    // Check attempts
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_TOO_MANY_ATTEMPTS,
        'Too many failed attempts. Please request a new OTP.'
      );
    }

    // Verify code using timing-safe comparison
    const isValid = await this.verifyHash(request.code, otp.codeHash);
    if (!isValid) {
      await this.dbAdapter.incrementAttempts(otp.id);
      const remainingAttempts = MAX_ATTEMPTS - otp.attempts - 1;
      throw new CustomerOTPError(
        CustomerAuthErrorCode.OTP_INVALID,
        remainingAttempts > 0
          ? `Invalid OTP code. ${remainingAttempts} attempts remaining.`
          : 'Invalid OTP code. Please request a new one.'
      );
    }

    // Mark as verified
    await this.dbAdapter.markVerified(otp.id);

    console.log(`[CustomerOTP] Verified OTP for ***${normalizedPhone.slice(-4)}`);

    return otp;
  }

  /**
   * Cleanup expired OTPs (run periodically)
   */
  async cleanup(): Promise<void> {
    await this.dbAdapter.cleanupExpiredOTPs();
    console.log('[CustomerOTP] Cleaned up expired OTPs');
  }

  /**
   * Get expiry time for OTPs
   */
  getExpiryMinutes(): number {
    return OTP_TTL_MINUTES;
  }

  /**
   * Get max attempts allowed
   */
  getMaxAttempts(): number {
    return MAX_ATTEMPTS;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: CustomerOTPService | null = null;

export function getCustomerOTPService(
  dbAdapter?: CustomerOTPDatabaseAdapter,
  smsProvider?: CustomerSMSProvider
): CustomerOTPService {
  if (!instance && dbAdapter && smsProvider) {
    instance = new CustomerOTPService(dbAdapter, smsProvider);
  }
  if (!instance) {
    throw new Error('CustomerOTPService not initialized');
  }
  return instance;
}

export function resetCustomerOTPService(): void {
  instance = null;
}
