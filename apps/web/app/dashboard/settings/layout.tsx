/**
 * Settings Layout - Server Component with Role Guard
 * 
 * Security: Prevents URL bypassing by checking role server-side.
 * This layout wraps ALL /dashboard/settings/* pages.
 * 
 * Only OWNER role can access the settings section.
 * 
 * Hardened: Feb 2026
 */

import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth';

export default async function SettingsLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    // ═══════════════════════════════════════════════════════════════════════════
    // SECURITY: Server-side role verification for entire settings section
    // ═══════════════════════════════════════════════════════════════════════════
    const session = await getSession();

    if (!session) {
        redirect('/auth/signin');
    }

    // Only OWNER can access settings pages
    // This blocks TECHNICIAN and DISPATCHER roles from direct URL access
    if (session.role.toUpperCase() !== 'OWNER') {
        redirect('/dashboard');
    }

    // Role verified - render children
    return <>{children}</>;
}
