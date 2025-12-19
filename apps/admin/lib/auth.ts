import { cookies } from 'next/headers';
import { AdminUser } from '@/types';

// SEPARATE AUTH FROM BUSINESS USERS
// This is a completely independent authentication system for CampoTech internal admins
// NOT connected to the business user auth system

// Hardcoded admin users (in production, use environment variables or separate database)
const ADMIN_USERS: Record<string, { password: string; user: AdminUser }> = {
  'admin@campotech.com.ar': {
    password: process.env.ADMIN_PASSWORD || 'campotech-admin-2025',
    user: {
      id: 'admin-1',
      email: 'admin@campotech.com.ar',
      name: 'Admin Principal',
      role: 'super_admin',
    },
  },
  'kevin@campotech.com.ar': {
    password: process.env.KEVIN_PASSWORD || 'kevin-admin-2025',
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

export function validateCredentials(email: string, password: string): AdminUser | null {
  const adminEntry = ADMIN_USERS[email.toLowerCase()];
  if (!adminEntry) return null;
  if (adminEntry.password !== password) return null;
  return adminEntry.user;
}

export function generateSessionToken(userId: string): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2);
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
