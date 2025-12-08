/**
 * Session Service
 * ===============
 *
 * Manages user sessions and refresh token rotation.
 */

import {
  Session,
  DeviceInfo,
  TokenPair,
  AuthenticatedUser,
  AuthResult,
  AuthContext,
  AuthErrorCode,
  UserRole,
} from '../types/auth.types';
import { TokenService, getTokenService } from './token.service';

/**
 * Session database adapter interface
 */
export interface SessionDatabaseAdapter {
  createSession(session: Omit<Session, 'id' | 'createdAt'>): Promise<Session>;
  getSessionByRefreshTokenHash(hash: string): Promise<Session | null>;
  updateSessionLastUsed(id: string): Promise<void>;
  revokeSession(id: string, reason: string): Promise<void>;
  revokeAllUserSessions(userId: string, reason: string): Promise<void>;
  cleanupExpiredSessions(): Promise<void>;
}

/**
 * User repository interface
 */
export interface UserRepository {
  getUserById(id: string): Promise<AuthenticatedUser | null>;
  getUserByPhone(phone: string): Promise<AuthenticatedUser | null>;
  updateLastSeen(userId: string): Promise<void>;
}

/**
 * Session Service class
 */
export class SessionService {
  private sessionAdapter: SessionDatabaseAdapter;
  private userRepository: UserRepository;
  private tokenService: TokenService;

  constructor(
    sessionAdapter: SessionDatabaseAdapter,
    userRepository: UserRepository,
    tokenService: TokenService
  ) {
    this.sessionAdapter = sessionAdapter;
    this.userRepository = userRepository;
    this.tokenService = tokenService;
  }

  /**
   * Create a new session after successful authentication
   */
  async createSession(
    userId: string,
    deviceInfo?: DeviceInfo,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    // Get user info
    const user = await this.userRepository.getUserById(userId);
    if (!user) {
      throw new SessionError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }

    // Generate tokens
    const tokens = await this.tokenService.generateTokenPair(
      user.id,
      user.orgId,
      user.role
    );

    // Create session
    const refreshTokenHash = this.tokenService.hashRefreshToken(tokens.refreshToken);
    const expiresAt = new Date(
      Date.now() + this.tokenService.getRefreshTokenTTL() * 1000
    );

    const session = await this.sessionAdapter.createSession({
      userId: user.id,
      orgId: user.orgId,
      deviceInfo,
      ipAddress,
      userAgent,
      refreshTokenHash,
      isActive: true,
      lastUsedAt: new Date(),
      expiresAt,
    });

    // Update user last seen
    await this.userRepository.updateLastSeen(user.id);

    console.log(`[Session] Created session for user ${user.id}`);

    return {
      user,
      tokens,
      session,
    };
  }

  /**
   * Refresh tokens using refresh token
   */
  async refreshTokens(refreshToken: string): Promise<TokenPair> {
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);

    // Find session
    const session = await this.sessionAdapter.getSessionByRefreshTokenHash(refreshTokenHash);

    if (!session) {
      throw new SessionError(AuthErrorCode.INVALID_TOKEN, 'Invalid refresh token');
    }

    if (!session.isActive) {
      throw new SessionError(AuthErrorCode.SESSION_REVOKED, 'Session has been revoked');
    }

    if (new Date() > session.expiresAt) {
      throw new SessionError(AuthErrorCode.SESSION_EXPIRED, 'Session has expired');
    }

    // Get user
    const user = await this.userRepository.getUserById(session.userId);
    if (!user) {
      throw new SessionError(AuthErrorCode.USER_NOT_FOUND, 'User not found');
    }

    // Generate new tokens
    const newTokens = await this.tokenService.generateTokenPair(
      user.id,
      user.orgId,
      user.role
    );

    // Update session with new refresh token (rotation)
    const newRefreshTokenHash = this.tokenService.hashRefreshToken(newTokens.refreshToken);
    await this.sessionAdapter.createSession({
      userId: user.id,
      orgId: user.orgId,
      deviceInfo: session.deviceInfo,
      ipAddress: session.ipAddress,
      userAgent: session.userAgent,
      refreshTokenHash: newRefreshTokenHash,
      isActive: true,
      lastUsedAt: new Date(),
      expiresAt: new Date(Date.now() + this.tokenService.getRefreshTokenTTL() * 1000),
    });

    // Revoke old session
    await this.sessionAdapter.revokeSession(session.id, 'token_rotation');

    // Update last seen
    await this.userRepository.updateLastSeen(user.id);

    console.log(`[Session] Refreshed tokens for user ${user.id}`);

    return newTokens;
  }

  /**
   * Logout - revoke current session
   */
  async logout(refreshToken: string): Promise<void> {
    const refreshTokenHash = this.tokenService.hashRefreshToken(refreshToken);
    const session = await this.sessionAdapter.getSessionByRefreshTokenHash(refreshTokenHash);

    if (session) {
      await this.sessionAdapter.revokeSession(session.id, 'user_logout');
      console.log(`[Session] User ${session.userId} logged out`);
    }
  }

  /**
   * Revoke all sessions for a user
   */
  async revokeAllSessions(userId: string, reason: string): Promise<void> {
    await this.sessionAdapter.revokeAllUserSessions(userId, reason);
    console.log(`[Session] All sessions revoked for user ${userId}: ${reason}`);
  }

  /**
   * Validate access token and return auth context
   */
  async validateAccessToken(accessToken: string): Promise<AuthContext> {
    const payload = await this.tokenService.verifyAccessToken(accessToken);

    return {
      userId: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      sessionId: payload.jti || '',
    };
  }

  /**
   * Authenticate with phone OTP (after OTP verified)
   */
  async authenticateWithPhone(
    phone: string,
    deviceInfo?: DeviceInfo,
    ipAddress?: string,
    userAgent?: string
  ): Promise<AuthResult> {
    // Get or create user by phone
    let user = await this.userRepository.getUserByPhone(phone);

    if (!user) {
      // In production, this would create the user or return an error
      throw new SessionError(AuthErrorCode.USER_NOT_FOUND, 'User not found. Please sign up first.');
    }

    // Create session
    return this.createSession(user.id, deviceInfo, ipAddress, userAgent);
  }

  /**
   * Clean up expired sessions
   */
  async cleanup(): Promise<void> {
    await this.sessionAdapter.cleanupExpiredSessions();
  }
}

/**
 * Custom Session error
 */
export class SessionError extends Error {
  code: AuthErrorCode;

  constructor(code: AuthErrorCode, message: string) {
    super(message);
    this.code = code;
    this.name = 'SessionError';
  }
}

// Export singleton factory
let instance: SessionService | null = null;

export function getSessionService(
  sessionAdapter?: SessionDatabaseAdapter,
  userRepository?: UserRepository,
  tokenService?: TokenService
): SessionService {
  if (!instance && sessionAdapter && userRepository && tokenService) {
    instance = new SessionService(sessionAdapter, userRepository, tokenService);
  }
  if (!instance) {
    throw new Error('SessionService not initialized');
  }
  return instance;
}
