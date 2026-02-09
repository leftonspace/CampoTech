/**
 * Phase 7.5: Switch Organization API
 * ====================================
 * 
 * Allows users to switch their active organization when they belong to multiple.
 * 
 * POST - Switch to a different organization
 * GET - Get current org and list of all user's organizations
 * 
 * SECURITY FIX (MEDIUM-9): Now issues new JWT after org switch to prevent stale token issues
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, type TokenPayload } from '@/lib/auth';
import { multiOrgService } from '@/lib/services/multi-org.service';
import { createTokenPair, REFRESH_TOKEN_EXPIRY_DAYS } from '@/lib/auth-security';
import { prisma } from '@/lib/prisma';
import { logAuditEntry } from '@/lib/audit/logger';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function requireAuth(): Promise<{ user: TokenPayload } | NextResponse> {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        return { user: session };
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET: Get user's organizations
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET() {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    try {
        const organizations = await multiOrgService.getUserOrganizations(auth.user.userId);
        const defaultOrg = await multiOrgService.getDefaultOrganization(auth.user.userId);

        return NextResponse.json({
            success: true,
            currentOrganization: defaultOrg,
            organizations,
            hasMultipleOrgs: organizations.length > 1,
        });
    } catch (error) {
        console.error('[Switch Org API] GET error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST: Switch to a different organization
// SECURITY FIX (MEDIUM-9): Issues new JWT with updated organizationId
// ═══════════════════════════════════════════════════════════════════════════════

interface SwitchRequest {
    organizationId: string;
}

export async function POST(request: NextRequest) {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    try {
        const body: SwitchRequest = await request.json();

        if (!body.organizationId) {
            return NextResponse.json(
                { error: 'organizationId is required' },
                { status: 400 }
            );
        }

        const result = await multiOrgService.switchOrganization(
            auth.user.userId,
            body.organizationId
        );

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: 400 }
            );
        }

        // SECURITY FIX (MEDIUM-9): Get org details and issue new JWT with correct organizationId
        const user = await prisma.user.findUnique({
            where: { id: auth.user.userId },
            include: { organization: true },
        });

        const targetOrg = await prisma.organization.findUnique({
            where: { id: body.organizationId },
        });

        if (!user || !targetOrg) {
            return NextResponse.json({ error: 'User or organization not found' }, { status: 404 });
        }

        // Create new tokens with the switched organization
        const userAgent = request.headers.get('user-agent') || undefined;
        const tokenPair = await createTokenPair(
            {
                userId: user.id,
                email: user.email,
                role: result.role || user.role,
                organizationId: body.organizationId, // New org ID
                subscriptionTier: targetOrg.subscriptionTier,
                subscriptionStatus: targetOrg.subscriptionStatus,
            },
            userAgent
        );

        // Security Fix: LOW-2 from Phase 6 Authorization Audit
        // Log organization switch for forensic audit trail
        const clientIP = request.headers.get('x-forwarded-for') ||
            request.headers.get('x-real-ip') ||
            'unknown';

        // Log async - don't block the response
        logAuditEntry({
            userId: auth.user.userId,
            userRole: result.role || auth.user.role,
            organizationId: body.organizationId, // Log against new org
            entityType: 'Organization',
            entityId: body.organizationId,
            action: 'ORG_SWITCH',
            fieldChanged: 'activeOrganization',
            oldValue: auth.user.organizationId,
            newValue: body.organizationId,
            ipAddress: clientIP,
            userAgent: request.headers.get('user-agent') || undefined,
            metadata: {
                previousOrganization: auth.user.organizationId,
                newOrganization: body.organizationId,
                newOrganizationName: result.organizationName,
            },
        }).catch(err => console.error('[Switch Org] Audit log error:', err));

        const response = NextResponse.json({
            success: true,
            message: `Switched to ${result.organizationName}`,
            organizationId: result.organizationId,
            organizationName: result.organizationName,
            role: result.role,
            // Token is now refreshed server-side - no client action needed
            tokenRefreshed: true,
        });

        // Set new cookies with updated JWT
        response.cookies.set('auth-token', tokenPair.accessToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            maxAge: 60 * 60 * 24, // 24 hours
        });

        response.cookies.set('refresh-token', tokenPair.refreshToken, {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict',
            path: '/api/auth/refresh',
            maxAge: 60 * 60 * 24 * REFRESH_TOKEN_EXPIRY_DAYS,
        });

        return response;
    } catch (error) {
        console.error('[Switch Org API] POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
