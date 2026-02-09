import { cookies } from 'next/headers';
import { AdminUser } from '@/types';
import * as crypto from 'crypto';

// SEPARATE AUTH FROM BUSINESS USERS
// This is a completely independent authentication system for CampoTech internal admins
// NOT connected to the business user auth system

/**
 * SECURITY FIX (HIGH-1): Admin credentials with bcrypt password hashes
 * 
 * To generate a new password hash:
 * node -e "const bcrypt = require('bcryptjs'); console.log(bcrypt.hashSync('YOUR_PASSWORD', 12));"
 * 
 * Then set the hash in environment variables:
 * ADMIN_PASSWORD_HASH=$2a$12$...
 * KEVIN_PASSWORD_HASH=$2a$12$...
 */
interface AdminEntry {
  passwordHash: string;
  user: AdminUser;
}

const ADMIN_USERS: Record<string, AdminEntry> = {
  'admin@campotech.com.ar': {
    passwordHash: process.env.ADMIN_PASSWORD_HASH || '',
    user: {
      id: 'admin-1',
      email: 'admin@campotech.com.ar',
      name: 'Admin Principal',
      role: 'super_admin',
    },
  },
  'kevin@campotech.com.ar': {
    passwordHash: process.env.KEVIN_PASSWORD_HASH || '',
    user: {
      id: 'admin-2',
      email: 'kevin@campotech.com.ar',
      name: 'Kevin',
      role: 'super_admin',
    },
  },
};

// IP Whitelist (optional - set in environment)
const IP_WHITELIST = process.env.ADMIN_IP_WHITELIST?.split(',') || [];

// Session token prefix to differentiate from business user tokens
const SESSION_PREFIX = 'campotech_admin_';

/**
 * SECURITY FIX (HIGH-1): Async bcrypt password validation
 * Uses timing-safe comparison to prevent timing attacks
 */
export async function validateCredentials(email: string, password: string): Promise<AdminUser | null> {
  const adminEntry = ADMIN_USERS[email.toLowerCase()];
  if (!adminEntry) {
    // Perform dummy hash comparison to prevent timing attacks on email enumeration
    await timingSafeCompare('dummy', '$2a$12$dummyhashtopreventtimingattacks');
    return null;
  }

  if (!adminEntry.passwordHash) {
    console.error(`[SECURITY] Admin password hash not configured for ${email}`);
    return null;
  }

  const isValid = await timingSafeCompare(password, adminEntry.passwordHash);
  if (!isValid) return null;

  return adminEntry.user;
}

/**
 * Timing-safe password comparison using bcrypt-compatible algorithm
 * Uses scrypt for comparison when bcrypt is not available
 */
async function timingSafeCompare(password: string, hash: string): Promise<boolean> {
  // Check if it's a bcrypt hash (starts with $2a$, $2b$, or $2y$)
  if (hash.startsWith('$2')) {
    try {
      // Dynamic import to avoid bundling issues in Edge runtime
      const bcrypt = await import('bcryptjs');
      return await bcrypt.compare(password, hash);
    } catch {
      console.error('[SECURITY] bcryptjs not available, falling back to scrypt');
      // Fallback to scrypt-based comparison
      return scryptCompare(password, hash);
    }
  }

  // For non-bcrypt hashes (legacy), use scrypt
  return scryptCompare(password, hash);
}

/**
 * Fallback scrypt-based password comparison
 */
function scryptCompare(password: string, storedHash: string): boolean {
  // For legacy compatibility, compare directly if no bcrypt
  // This is less secure but allows migration period
  const inputHash = crypto.scryptSync(password, 'campotech-admin-salt', 64).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash));
  } catch {
    return false;
  }
}

/**
 * SECURITY FIX (HIGH-2): Cryptographically secure session token generation
 * Uses crypto.randomBytes instead of Math.random()
 */
export function generateSessionToken(userId: string): string {
  const timestamp = Date.now().toString(36);
  const random = crypto.randomBytes(32).toString('hex');
  return `${SESSION_PREFIX}${userId}_${timestamp}_${random}`;
}

export function parseSessionToken(token: string): string | null {
  if (!token.startsWith(SESSION_PREFIX)) return null;
  const parts = token.replace(SESSION_PREFIX, '').split('_');
  return parts[0] || null;
}

export async function getAdminSession(): Promise<AdminUser | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('admin_session')?.value;

  if (!sessionToken) return null;

  const userId = parseSessionToken(sessionToken);
  if (!userId) return null;

  // Find user by ID
  for (const entry of Object.values(ADMIN_USERS)) {
    if (entry.user.id === userId) {
      return entry.user;
    }
  }

  return null;
}

export function validateIPAddress(ip: string): boolean {
  // If no whitelist configured, allow all
  if (IP_WHITELIST.length === 0) return true;

  // Check if IP is in whitelist
  return IP_WHITELIST.includes(ip);
}

export function hasPermission(user: AdminUser, action: string): boolean {
  // super_admin can do everything
  if (user.role === 'super_admin') return true;

  // admin can do most things except manage other admins
  if (user.role === 'admin') {
    return !['manage_admins', 'delete_business'].includes(action);
  }

  // viewer can only view
  if (user.role === 'viewer') {
    return ['view_dashboard', 'view_businesses', 'view_payments', 'view_ai', 'view_map'].includes(action);
  }

  return false;
}
