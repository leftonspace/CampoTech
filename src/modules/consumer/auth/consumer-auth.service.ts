/**
 * Consumer Authentication Service
 * ================================
 *
 * Phone-only OTP authentication for marketplace consumers.
 * Phase 15: Consumer Marketplace
 */

import { Pool, PoolClient } from 'pg';
import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';
import {
  ConsumerProfile,
  ConsumerSession,
  ConsumerAuthContext,
  ConsumerAuthResult,
  ConsumerDeviceInfo,
  ConsumerAuthErrorCode,
  CreateConsumerDTO,
} from '../consumer.types';
import { ConsumerProfileRepository } from '../profiles/consumer-profile.repository';

// ═══════════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════════

const CONFIG = {
  OTP_LENGTH: 6,
  OTP_EXPIRY_MINUTES: 5,
  OTP_MAX_ATTEMPTS: 3,
  ACCESS_TOKEN_EXPIRY: '15m',
  REFRESH_TOKEN_EXPIRY_DAYS: 30,
  SESSION_CLEANUP_DAYS: 30,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR CLASS
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsumerAuthError extends Error {
  code: ConsumerAuthErrorCode;
  httpStatus: number;

  constructor(code: ConsumerAuthErrorCode, message: string, httpStatus = 400) {
    super(message);
    this.code = code;
    this.httpStatus = httpStatus;
    this.name = 'ConsumerAuthError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// OTP SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsumerOTPService {
  constructor(private pool: Pool) {}

  /**
   * Generate and store OTP for phone number
   */
  async generateOTP(phone: string): Promise<{ code: string; expiresAt: Date }> {
    // Generate 6-digit OTP
    const code = this.generateOTPCode();
    const expiresAt = new Date(Date.now() + CONFIG.OTP_EXPIRY_MINUTES * 60 * 1000);

    // Delete any existing OTPs for this phone
    await this.pool.query(
      `DELETE FROM consumer_otp_codes WHERE phone = $1`,
      [phone]
    );

    // Insert new OTP
    await this.pool.query(
      `INSERT INTO consumer_otp_codes (phone, code, expires_at, max_attempts)
       VALUES ($1, $2, $3, $4)`,
      [phone, code, expiresAt, CONFIG.OTP_MAX_ATTEMPTS]
    );

    console.log(`[ConsumerAuth] OTP generated for ${phone.slice(-4)}`);

    return { code, expiresAt };
  }

  /**
   * Verify OTP
   */
  async verifyOTP(phone: string, code: string): Promise<boolean> {
    // Get OTP record
    const result = await this.pool.query(
      `SELECT * FROM consumer_otp_codes
       WHERE phone = $1 AND is_used = false
       ORDER BY created_at DESC
       LIMIT 1`,
      [phone]
    );

    if (result.rows.length === 0) {
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.OTP_INVALID,
        'No OTP found for this phone number'
      );
    }

    const otpRecord = result.rows[0];

    // Check expiry
    if (new Date(otpRecord.expires_at) < new Date()) {
      await this.deleteOTP(phone);
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.OTP_EXPIRED,
        'OTP has expired. Please request a new one.'
      );
    }

    // Check max attempts
    if (otpRecord.attempts >= otpRecord.max_attempts) {
      await this.deleteOTP(phone);
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.OTP_MAX_ATTEMPTS,
        'Maximum OTP attempts exceeded. Please request a new one.'
      );
    }

    // Increment attempts
    await this.pool.query(
      `UPDATE consumer_otp_codes SET attempts = attempts + 1 WHERE id = $1`,
      [otpRecord.id]
    );

    // Verify code
    if (otpRecord.code !== code) {
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.OTP_INVALID,
        'Invalid OTP code'
      );
    }

    // Mark as used
    await this.pool.query(
      `UPDATE consumer_otp_codes SET is_used = true WHERE id = $1`,
      [otpRecord.id]
    );

    console.log(`[ConsumerAuth] OTP verified for ${phone.slice(-4)}`);

    return true;
  }

  /**
   * Delete OTP for phone
   */
  async deleteOTP(phone: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM consumer_otp_codes WHERE phone = $1`,
      [phone]
    );
  }

  /**
   * Cleanup expired OTPs
   */
  async cleanup(): Promise<number> {
    const result = await this.pool.query(
      `DELETE FROM consumer_otp_codes WHERE expires_at < NOW() OR is_used = true`
    );
    return result.rowCount || 0;
  }

  /**
   * Generate random OTP code
   */
  private generateOTPCode(): string {
    // Generate cryptographically secure random number
    const randomBytes = crypto.randomBytes(4);
    const randomNumber = randomBytes.readUInt32BE(0);
    const code = (randomNumber % 1000000).toString().padStart(CONFIG.OTP_LENGTH, '0');
    return code;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SESSION SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsumerSessionService {
  private jwtSecret: string;

  constructor(private pool: Pool, jwtSecret: string) {
    this.jwtSecret = jwtSecret;
  }

  /**
   * Create new session for consumer
   */
  async createSession(
    consumer: ConsumerProfile,
    deviceInfo?: ConsumerDeviceInfo,
    ipAddress?: string
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Generate tokens
    const { accessToken, refreshToken, refreshTokenHash, expiresIn } =
      this.generateTokens(consumer);

    // Calculate session expiry
    const expiresAt = new Date(
      Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    // Store session
    await this.pool.query(
      `INSERT INTO consumer_sessions (
        consumer_id, refresh_token_hash,
        device_type, device_id, device_name, app_version,
        ip_address, expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        consumer.id,
        refreshTokenHash,
        deviceInfo?.deviceType || null,
        deviceInfo?.deviceId || null,
        deviceInfo?.deviceName || null,
        deviceInfo?.appVersion || null,
        ipAddress || null,
        expiresAt,
      ]
    );

    console.log(`[ConsumerAuth] Session created for consumer ${consumer.id.slice(0, 8)}...`);

    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Validate access token
   */
  async validateAccessToken(token: string): Promise<ConsumerAuthContext> {
    try {
      const payload = jwt.verify(token, this.jwtSecret) as any;

      return {
        consumerId: payload.consumerId,
        phone: payload.phone,
        firstName: payload.firstName,
        sessionId: payload.sessionId,
        issuedAt: payload.iat,
        expiresAt: payload.exp,
      };
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        throw new ConsumerAuthError(
          ConsumerAuthErrorCode.TOKEN_EXPIRED,
          'Access token has expired',
          401
        );
      }
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.TOKEN_INVALID,
        'Invalid access token',
        401
      );
    }
  }

  /**
   * Refresh tokens using refresh token
   */
  async refreshTokens(
    refreshToken: string,
    profileRepo: ConsumerProfileRepository
  ): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    // Hash the refresh token
    const tokenHash = this.hashToken(refreshToken);

    // Find session
    const sessionResult = await this.pool.query(
      `SELECT cs.*, cp.phone, cp.first_name, cp.is_suspended
       FROM consumer_sessions cs
       JOIN consumer_profiles cp ON cp.id = cs.consumer_id
       WHERE cs.refresh_token_hash = $1 AND cs.is_active = true`,
      [tokenHash]
    );

    if (sessionResult.rows.length === 0) {
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.SESSION_INVALID,
        'Invalid refresh token',
        401
      );
    }

    const session = sessionResult.rows[0];

    // Check expiry
    if (new Date(session.expires_at) < new Date()) {
      await this.revokeSession(session.id);
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.SESSION_EXPIRED,
        'Session has expired',
        401
      );
    }

    // Check if consumer is suspended
    if (session.is_suspended) {
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.CONSUMER_SUSPENDED,
        'Your account has been suspended',
        403
      );
    }

    // Get consumer profile
    const consumer = await profileRepo.findById(session.consumer_id);
    if (!consumer) {
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.CONSUMER_NOT_FOUND,
        'Consumer not found',
        404
      );
    }

    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken, refreshTokenHash, expiresIn } =
      this.generateTokens(consumer);

    // Update session with new refresh token
    const newExpiresAt = new Date(
      Date.now() + CONFIG.REFRESH_TOKEN_EXPIRY_DAYS * 24 * 60 * 60 * 1000
    );

    await this.pool.query(
      `UPDATE consumer_sessions
       SET refresh_token_hash = $2, expires_at = $3, last_used_at = NOW()
       WHERE id = $1`,
      [session.id, refreshTokenHash, newExpiresAt]
    );

    // Update consumer last active
    await profileRepo.updateLastActive(consumer.id);

    return { accessToken, refreshToken: newRefreshToken, expiresIn };
  }

  /**
   * Logout (revoke session)
   */
  async logout(refreshToken: string): Promise<void> {
    const tokenHash = this.hashToken(refreshToken);

    await this.pool.query(
      `UPDATE consumer_sessions SET is_active = false WHERE refresh_token_hash = $1`,
      [tokenHash]
    );
  }

  /**
   * Logout from all devices
   */
  async logoutAll(consumerId: string): Promise<void> {
    await this.pool.query(
      `UPDATE consumer_sessions SET is_active = false WHERE consumer_id = $1`,
      [consumerId]
    );
    console.log(`[ConsumerAuth] All sessions revoked for consumer ${consumerId.slice(0, 8)}...`);
  }

  /**
   * Get active sessions for consumer
   */
  async getActiveSessions(consumerId: string): Promise<ConsumerSession[]> {
    const result = await this.pool.query(
      `SELECT * FROM consumer_sessions
       WHERE consumer_id = $1 AND is_active = true
       ORDER BY last_used_at DESC`,
      [consumerId]
    );

    return result.rows.map(row => ({
      id: row.id,
      consumerId: row.consumer_id,
      refreshTokenHash: row.refresh_token_hash,
      deviceType: row.device_type,
      deviceId: row.device_id,
      deviceName: row.device_name,
      appVersion: row.app_version,
      ipAddress: row.ip_address,
      isActive: row.is_active,
      lastUsedAt: row.last_used_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
    }));
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.pool.query(
      `UPDATE consumer_sessions SET is_active = false WHERE id = $1`,
      [sessionId]
    );
  }

  /**
   * Cleanup expired sessions
   */
  async cleanup(): Promise<number> {
    const result = await this.pool.query(
      `UPDATE consumer_sessions SET is_active = false WHERE expires_at < NOW() AND is_active = true`
    );
    return result.rowCount || 0;
  }

  /**
   * Generate access and refresh tokens
   */
  private generateTokens(consumer: ConsumerProfile): {
    accessToken: string;
    refreshToken: string;
    refreshTokenHash: string;
    expiresIn: number;
  } {
    const sessionId = crypto.randomUUID();

    // Generate access token
    const accessToken = jwt.sign(
      {
        consumerId: consumer.id,
        phone: consumer.phone,
        firstName: consumer.firstName,
        sessionId,
      },
      this.jwtSecret,
      { expiresIn: CONFIG.ACCESS_TOKEN_EXPIRY }
    );

    // Generate refresh token (random string)
    const refreshToken = crypto.randomBytes(64).toString('base64url');
    const refreshTokenHash = this.hashToken(refreshToken);

    // Calculate expiry in seconds
    const expiresIn = 15 * 60; // 15 minutes

    return { accessToken, refreshToken, refreshTokenHash, expiresIn };
  }

  /**
   * Hash token for storage
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN AUTH SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class ConsumerAuthService {
  private profileRepo: ConsumerProfileRepository;
  private otpService: ConsumerOTPService;
  private sessionService: ConsumerSessionService;

  constructor(pool: Pool, jwtSecret: string) {
    this.profileRepo = new ConsumerProfileRepository(pool);
    this.otpService = new ConsumerOTPService(pool);
    this.sessionService = new ConsumerSessionService(pool, jwtSecret);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // OTP AUTHENTICATION
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Request OTP for phone number
   */
  async requestOTP(phone: string): Promise<{ expiresAt: Date }> {
    // Validate phone format
    const normalizedPhone = this.normalizePhone(phone);
    if (!this.isValidPhone(normalizedPhone)) {
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.INVALID_PHONE,
        'Invalid phone number format'
      );
    }

    // Generate OTP
    const { code, expiresAt } = await this.otpService.generateOTP(normalizedPhone);

    // TODO: Send OTP via SMS/WhatsApp
    // For now, log it (in production, integrate with SMS provider)
    console.log(`[ConsumerAuth] OTP for ${normalizedPhone}: ${code}`);

    return { expiresAt };
  }

  /**
   * Verify OTP and authenticate consumer
   */
  async verifyOTP(
    phone: string,
    code: string,
    deviceInfo?: ConsumerDeviceInfo,
    ipAddress?: string
  ): Promise<ConsumerAuthResult> {
    const normalizedPhone = this.normalizePhone(phone);

    // Verify OTP
    await this.otpService.verifyOTP(normalizedPhone, code);

    // Get or create consumer
    let consumer = await this.profileRepo.findByPhone(normalizedPhone);
    let isNewConsumer = false;

    if (!consumer) {
      // Create new consumer
      consumer = await this.profileRepo.create({
        phone: normalizedPhone,
        firstName: 'Usuario', // Default name, can be updated later
      });
      isNewConsumer = true;
      console.log(`[ConsumerAuth] New consumer created: ${consumer.id.slice(0, 8)}...`);
    } else {
      // Update phone verified status
      if (!consumer.phoneVerified) {
        await this.profileRepo.setPhoneVerified(consumer.id, true);
        consumer.phoneVerified = true;
      }
    }

    // Check if suspended
    if (consumer.isSuspended) {
      throw new ConsumerAuthError(
        ConsumerAuthErrorCode.CONSUMER_SUSPENDED,
        `Your account has been suspended: ${consumer.suspensionReason || 'Contact support'}`,
        403
      );
    }

    // Create session
    const tokens = await this.sessionService.createSession(consumer, deviceInfo, ipAddress);

    // Update last active
    await this.profileRepo.updateLastActive(consumer.id);

    return {
      ...tokens,
      consumer,
      isNewConsumer,
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SESSION MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Validate access token
   */
  async validateToken(accessToken: string): Promise<ConsumerAuthContext> {
    return this.sessionService.validateAccessToken(accessToken);
  }

  /**
   * Refresh tokens
   */
  async refreshTokens(refreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }> {
    return this.sessionService.refreshTokens(refreshToken, this.profileRepo);
  }

  /**
   * Logout
   */
  async logout(refreshToken: string): Promise<void> {
    await this.sessionService.logout(refreshToken);
  }

  /**
   * Logout from all devices
   */
  async logoutAll(consumerId: string): Promise<void> {
    await this.sessionService.logoutAll(consumerId);
  }

  /**
   * Get active sessions
   */
  async getActiveSessions(consumerId: string): Promise<ConsumerSession[]> {
    return this.sessionService.getActiveSessions(consumerId);
  }

  /**
   * Revoke specific session
   */
  async revokeSession(sessionId: string): Promise<void> {
    await this.sessionService.revokeSession(sessionId);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PROFILE ACCESS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Get consumer by ID
   */
  async getConsumerById(id: string): Promise<ConsumerProfile | null> {
    return this.profileRepo.findById(id);
  }

  /**
   * Get consumer by phone
   */
  async getConsumerByPhone(phone: string): Promise<ConsumerProfile | null> {
    return this.profileRepo.findByPhone(this.normalizePhone(phone));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // CLEANUP
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Cleanup expired OTPs and sessions
   */
  async cleanup(): Promise<{ otps: number; sessions: number }> {
    const [otps, sessions] = await Promise.all([
      this.otpService.cleanup(),
      this.sessionService.cleanup(),
    ]);
    return { otps, sessions };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // HELPERS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Normalize phone number to E.164 format for Argentina
   */
  private normalizePhone(phone: string): string {
    // Remove all non-digits
    let digits = phone.replace(/\D/g, '');

    // Handle Argentine phone numbers
    if (digits.startsWith('0')) {
      digits = digits.slice(1);
    }

    // Add country code if missing
    if (!digits.startsWith('54')) {
      // Remove leading 15 (area code prefix)
      if (digits.startsWith('15')) {
        digits = digits.slice(2);
      }
      digits = '54' + digits;
    }

    // Add 9 after country code if missing (for mobile)
    if (digits.startsWith('54') && !digits.startsWith('549')) {
      digits = '549' + digits.slice(2);
    }

    return '+' + digits;
  }

  /**
   * Validate phone number format
   */
  private isValidPhone(phone: string): boolean {
    // Argentine mobile: +549XXXXXXXXXX (13 digits total)
    return /^\+549\d{10}$/.test(phone);
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON
// ═══════════════════════════════════════════════════════════════════════════════

let instance: ConsumerAuthService | null = null;

export function getConsumerAuthService(): ConsumerAuthService {
  if (!instance) {
    throw new Error('ConsumerAuthService not initialized');
  }
  return instance;
}

export function initializeConsumerAuthService(
  pool: Pool,
  jwtSecret: string
): ConsumerAuthService {
  instance = new ConsumerAuthService(pool, jwtSecret);
  return instance;
}

export function resetConsumerAuthService(): void {
  instance = null;
}
