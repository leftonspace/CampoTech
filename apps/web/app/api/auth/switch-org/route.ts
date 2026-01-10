/**
 * Phase 7.5: Switch Organization API
 * ====================================
 * 
 * Allows users to switch their active organization when they belong to multiple.
 * 
 * POST - Switch to a different organization
 * GET - Get current org and list of all user's organizations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, type TokenPayload } from '@/lib/auth';
import { multiOrgService } from '@/lib/services/multi-org.service';

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

        // Note: The frontend should refresh the session/token after this
        // to get the updated organizationId in the JWT

        return NextResponse.json({
            success: true,
            message: `Switched to ${result.organizationName}`,
            organizationId: result.organizationId,
            organizationName: result.organizationName,
            role: result.role,
            // Frontend should re-fetch session or trigger token refresh
            requiresSessionRefresh: true,
        });
    } catch (error) {
        console.error('[Switch Org API] POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
