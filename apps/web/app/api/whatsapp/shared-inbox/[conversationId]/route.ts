/**
 * Phase 6.2: Conversation Assignment API
 * ========================================
 * 
 * Get assignment history for a specific conversation.
 * 
 * GET - Get assignment history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, type TokenPayload } from '@/lib/auth';
import { sharedInboxService } from '@/lib/services/shared-inbox.service';
import { prisma } from '@/lib/prisma';

interface RouteParams {
    params: Promise<{ conversationId: string }>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

async function requireAuth(): Promise<{ user: TokenPayload } | NextResponse> {
    try {
        const session = await getSession();

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        if (!session.organizationId) {
            return NextResponse.json({ error: 'No organization' }, { status: 400 });
        }

        return { user: session };
    } catch {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// GET: Get assignment history for a conversation
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest, { params }: RouteParams) {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    try {
        const { conversationId } = await params;

        // Verify conversation belongs to user's organization
        const conversation = await prisma.waConversation.findUnique({
            where: { id: conversationId },
            select: {
                id: true,
                organizationId: true,
                assignedToId: true,
                customerName: true,
                customerPhone: true,
            },
        });

        if (!conversation) {
            return NextResponse.json(
                { error: 'Conversation not found' },
                { status: 404 }
            );
        }

        if (conversation.organizationId !== auth.user.organizationId) {
            return NextResponse.json(
                { error: 'Not authorized to view this conversation' },
                { status: 403 }
            );
        }

        // Check if user can see this conversation
        const inboxRole = sharedInboxService.getInboxRole(auth.user.role || '');
        const canSeeAll = sharedInboxService.canSeeAllConversations(inboxRole);
        const isAssignedToMe = conversation.assignedToId === auth.user.userId;

        if (!canSeeAll && !isAssignedToMe) {
            return NextResponse.json(
                { error: 'Not authorized to view this conversation' },
                { status: 403 }
            );
        }

        // Get assignment history
        const history = await sharedInboxService.getAssignmentHistory(conversationId);

        return NextResponse.json({
            success: true,
            conversation: {
                id: conversation.id,
                customerName: conversation.customerName,
                customerPhone: conversation.customerPhone,
                assignedToId: conversation.assignedToId,
            },
            history,
        });
    } catch (error) {
        console.error('[SharedInbox API] GET history error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
