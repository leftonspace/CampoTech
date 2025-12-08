/**
 * Authentication Types
 * ====================
 *
 * Type definitions for the authentication system.
 */

// User roles
export type UserRole = 'owner' | 'admin' | 'dispatcher' | 'technician' | 'accountant';

// JWT payload
export interface JWTPayload {
  sub: string;        // User ID
  orgId: string;      // Organization ID
  role: UserRole;     // User role
  iat: number;        // Issued at
  exp: number;        // Expires at
  jti?: string;       // JWT ID (for revocation)
}

// Session data
export interface Session {
  id: string;
  userId: string;
  orgId: string;
  deviceInfo?: DeviceInfo;
  ipAddress?: string;
  userAgent?: string;
  isActive: boolean;
  lastUsedAt: Date;
  expiresAt: Date;
  createdAt: Date;
}

// Device information
export interface DeviceInfo {
  platform?: string;
  os?: string;
  browser?: string;
  deviceId?: string;
}

// OTP code record
export interface OTPCode {
  id: string;
  phone: string;
  codeHash: string;
  attempts: number;
  verified: boolean;
  verifiedAt?: Date;
  expiresAt: Date;
  createdAt: Date;
}

// Token pair
export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;      // Access token TTL in seconds
  tokenType: 'Bearer';
}

// Authentication result
export interface AuthResult {
  user: AuthenticatedUser;
  tokens: TokenPair;
  session: Session;
}

// Authenticated user info
export interface AuthenticatedUser {
  id: string;
  orgId: string;
  role: UserRole;
  fullName: string;
  phone?: string;
  email?: string;
}

// Auth context (set per request)
export interface AuthContext {
  userId: string;
  orgId: string;
  role: UserRole;
  sessionId: string;
}

// OTP send request
export interface SendOTPRequest {
  phone: string;
}

// OTP verify request
export interface VerifyOTPRequest {
  phone: string;
  code: string;
  deviceInfo?: DeviceInfo;
}

// Refresh token request
export interface RefreshTokenRequest {
  refreshToken: string;
}

// Auth error codes
export enum AuthErrorCode {
  INVALID_OTP = 'AUTH_001',
  SESSION_EXPIRED = 'AUTH_002',
  INSUFFICIENT_PERMISSIONS = 'AUTH_003',
  INVALID_TOKEN = 'AUTH_004',
  TOKEN_EXPIRED = 'AUTH_005',
  USER_NOT_FOUND = 'AUTH_006',
  USER_INACTIVE = 'AUTH_007',
  TOO_MANY_ATTEMPTS = 'AUTH_008',
  OTP_EXPIRED = 'AUTH_009',
  SESSION_REVOKED = 'AUTH_010',
  TOKEN_REVOKED = 'AUTH_011',
}

// Permission definitions
export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: ['*'],  // Full access
  admin: [
    'jobs:*',
    'customers:*',
    'invoices:*',
    'payments:*',
    'team:read',
    'reports:*',
    'settings:read',
  ],
  dispatcher: [
    'jobs:*',
    'customers:*',
    'whatsapp:*',
    'invoices:read',
  ],
  technician: [
    'jobs:read:assigned',
    'jobs:update:assigned',
    'customers:read',
  ],
  accountant: [
    'invoices:*',
    'payments:read',
    'reports:read',
  ],
};
