/**
 * OTP Service
 * ===========
 *
 * Handles phone OTP generation, storage, and verification.
 * Uses scrypt (bcrypt-equivalent) for secure OTP hashing.
 */

import * as crypto from 'crypto';
import { promisify } from 'util';
import { OTPCode, AuthErrorCode } from '../types/auth.types';

// Promisify scrypt for async usage
const scryptAsync = promisify(crypto.scrypt);

// Configuration
const OTP_LENGTH = 6;
const OTP_TTL_MINUTES = 5;
const MAX_ATTEMPTS = 3;
const RATE_LIMIT_WINDOW_MINUTES = 15;
const MAX_REQUESTS_PER_WINDOW = 5;

// Scrypt parameters (OWASP recommendations)
const SCRYPT_SALT_LENGTH = 16;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_N = 16384;  // CPU/memory cost
const SCRYPT_R = 8;      // Block size
const SCRYPT_P = 1;      // Parallelization

// In-memory rate limiting (use Redis in production)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

/**
 * Database adapter interface for OTP storage
 */
export interface OTPDatabaseAdapter {
  createOTP(phone: string, codeHash: string, expiresAt: Date): Promise<OTPCode>;
  getLatestOTP(phone: string): Promise<OTPCode | null>;
  incrementAttempts(id: string): Promise<void>;
  markVerified(id: string): Promise<void>;
  cleanupExpired(): Promise<void>;
}

/**
 * SMS provider interface
 */
export interface SMSProvider {
  sendSMS(phone: string, message: string): Promise<boolean>;
}

/**
 * OTP Service class
 */
export class OTPService {
  private dbAdapter: OTPDatabaseAdapter;
  private smsProvider: SMSProvider;

  constructor(dbAdapter: OTPDatabaseAdapter, smsProvider: SMSProvider) {
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
    const hash = await scryptAsync(code, salt, SCRYPT_KEY_LENGTH) as Buffer;
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

    const actualHash = await scryptAsync(code, salt, SCRYPT_KEY_LENGTH) as Buffer;

    // Use timing-safe comparison to prevent timing attacks
    if (actualHash.length !== expectedHash.length) {
      return false;
    }
    return crypto.timingSafeEqual(actualHash, expectedHash);
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(phone: string): void {
    const now = Date.now();
    const windowMs = RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;
    const entry = rateLimitMap.get(phone);

    if (entry) {
      if (now < entry.resetAt) {
        if (entry.count >= MAX_REQUESTS_PER_WINDOW) {
          throw new OTPError(
            AuthErrorCode.TOO_MANY_ATTEMPTS,
            'Too many OTP requests. Please try again later.'
          );
        }
        entry.count++;
      } else {
        // Reset window
        rateLimitMap.set(phone, { count: 1, resetAt: now + windowMs });
      }
    } else {
      rateLimitMap.set(phone, { count: 1, resetAt: now + windowMs });
    }
  }

  /**
   * Send OTP to phone number
   */
  async sendOTP(phone: string): Promise<{ expiresAt: Date }> {
    // Normalize phone number
    const normalizedPhone = this.normalizePhone(phone);

    // Check rate limiting
    this.checkRateLimit(normalizedPhone);

    // Generate code
    const code = this.generateCode();
    const codeHash = await this.hashCode(code);
    const expiresAt = new Date(Date.now() + OTP_TTL_MINUTES * 60 * 1000);

    // Store OTP
    await this.dbAdapter.createOTP(normalizedPhone, codeHash, expiresAt);

    // Send SMS
    const message = `Tu código de verificación de CampoTech es: ${code}. Válido por ${OTP_TTL_MINUTES} minutos.`;
    await this.smsProvider.sendSMS(normalizedPhone, message);

    console.log(`[OTP] Sent OTP to ${normalizedPhone.slice(-4).padStart(normalizedPhone.length, '*')}`);

    return { expiresAt };
  }

  /**
   * Verify OTP code
   */
  async verifyOTP(phone: string, code: string): Promise<boolean> {
    const normalizedPhone = this.normalizePhone(phone);

    // Get latest OTP for this phone
    const otp = await this.dbAdapter.getLatestOTP(normalizedPhone);

    if (!otp) {
      throw new OTPError(AuthErrorCode.INVALID_OTP, 'No OTP found for this phone number');
    }

    // Check if expired
    if (new Date() > otp.expiresAt) {
      throw new OTPError(AuthErrorCode.OTP_EXPIRED, 'OTP has expired');
    }

    // Check if already verified
    if (otp.verified) {
      throw new OTPError(AuthErrorCode.INVALID_OTP, 'OTP has already been used');
    }

    // Check attempts
    if (otp.attempts >= MAX_ATTEMPTS) {
      throw new OTPError(AuthErrorCode.TOO_MANY_ATTEMPTS, 'Too many failed attempts');
    }

    // Verify code using timing-safe comparison
    const isValid = await this.verifyHash(code, otp.codeHash);
    if (!isValid) {
      await this.dbAdapter.incrementAttempts(otp.id);
      throw new OTPError(AuthErrorCode.INVALID_OTP, 'Invalid OTP code');
    }

    // Mark as verified
    await this.dbAdapter.markVerified(otp.id);

    console.log(`[OTP] Verified OTP for ${normalizedPhone.slice(-4).padStart(normalizedPhone.length, '*')}`);

    return true;
  }

  /**
   * Normalize phone number to E.164 format
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
   * Clean up expired OTPs (run periodically)
   */
  async cleanup(): Promise<void> {
    await this.dbAdapter.cleanupExpired();

    // Clean up rate limit map
    const now = Date.now();
    for (const [phone, entry] of rateLimitMap.entries()) {
      if (now >= entry.resetAt) {
        rateLimitMap.delete(phone);
      }
    }
  }
}

/**
 * Custom OTP error
 */
export class OTPError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'OTPError';
  }
}

// Export singleton factory
let instance: OTPService | null = null;

export function getOTPService(
  dbAdapter?: OTPDatabaseAdapter,
  smsProvider?: SMSProvider
): OTPService {
  if (!instance && dbAdapter && smsProvider) {
    instance = new OTPService(dbAdapter, smsProvider);
  }
  if (!instance) {
    throw new Error('OTPService not initialized');
  }
  return instance;
}
