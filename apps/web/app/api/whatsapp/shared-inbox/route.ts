/**
 * Phase 6.2: Shared Inbox API
 * ============================
 * 
 * Manage team-based conversation assignments.
 * 
 * GET - Get inbox stats, team members, or conversations
 * POST - Assign/unassign conversations
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession, type TokenPayload } from '@/lib/auth';
import { sharedInboxService } from '@/lib/services/shared-inbox.service';

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
// GET: Get inbox data
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest) {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    try {
        const { searchParams } = new URL(request.url);
        const action = searchParams.get('action') || 'conversations';

        switch (action) {
            case 'stats': {
                // Get inbox statistics
                const stats = await sharedInboxService.getInboxStats(
                    auth.user.organizationId!,
                    auth.user.userId
                );
                return NextResponse.json({ success: true, stats });
            }

            case 'team': {
                // Get team members who can be assigned
                const team = await sharedInboxService.getAssignableTeamMembers(
                    auth.user.organizationId!
                );
                return NextResponse.json({ success: true, team });
            }

            case 'performance': {
                // Get agent performance (admin only)
                const inboxRole = sharedInboxService.getInboxRole(auth.user.role || '');
                if (!sharedInboxService.canSeeAllConversations(inboxRole)) {
                    return NextResponse.json(
                        { error: 'Not authorized to view performance metrics' },
                        { status: 403 }
                    );
                }

                const startDate = searchParams.get('startDate')
                    ? new Date(searchParams.get('startDate')!)
                    : undefined;
                const endDate = searchParams.get('endDate')
                    ? new Date(searchParams.get('endDate')!)
                    : undefined;

                const performance = await sharedInboxService.getAgentPerformance(
                    auth.user.organizationId!,
                    startDate,
                    endDate
                );
                return NextResponse.json({ success: true, performance });
            }

            case 'conversations':
            default: {
                // Get conversations for current user
                const filter = (searchParams.get('filter') || 'all') as
                    | 'all'
                    | 'assigned_to_me'
                    | 'unassigned'
                    | 'open'
                    | 'closed';
                const limit = parseInt(searchParams.get('limit') || '50', 10);
                const offset = parseInt(searchParams.get('offset') || '0', 10);

                const conversations = await sharedInboxService.getConversationsForUser(
                    auth.user.userId,
                    { filter, limit, offset }
                );
                return NextResponse.json({ success: true, conversations });
            }
        }
    } catch (error) {
        console.error('[SharedInbox API] GET error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}

// ═══════════════════════════════════════════════════════════════════════════════
// POST: Assignment operations
// ═══════════════════════════════════════════════════════════════════════════════

interface AssignmentRequest {
    action: 'assign' | 'unassign' | 'bulk_assign';
    conversationId?: string;
    conversationIds?: string[];
    assignedToId?: string;
    notes?: string;
}

export async function POST(request: NextRequest) {
    const auth = await requireAuth();
    if (auth instanceof NextResponse) return auth;

    try {
        const body: AssignmentRequest = await request.json();

        switch (body.action) {
            case 'assign': {
                if (!body.conversationId) {
                    return NextResponse.json(
                        { error: 'conversationId is required' },
                        { status: 400 }
                    );
                }
                if (!body.assignedToId) {
                    return NextResponse.json(
                        { error: 'assignedToId is required' },
                        { status: 400 }
                    );
                }

                const result = await sharedInboxService.assignConversation(
                    body.conversationId,
                    auth.user.userId,
                    body.assignedToId,
                    body.notes
                );

                if (!result.success) {
                    return NextResponse.json(
                        { error: result.error },
                        { status: 400 }
                    );
                }

                return NextResponse.json({
                    success: true,
                    message: 'Conversation assigned successfully',
                    conversationId: result.conversationId,
                    assignedToId: result.assignedToId,
                });
            }

            case 'unassign': {
                if (!body.conversationId) {
                    return NextResponse.json(
                        { error: 'conversationId is required' },
                        { status: 400 }
                    );
                }

                const result = await sharedInboxService.unassignConversation(
                    body.conversationId,
                    auth.user.userId,
                    body.notes
                );

                if (!result.success) {
                    return NextResponse.json(
                        { error: result.error },
                        { status: 400 }
                    );
                }

                return NextResponse.json({
                    success: true,
                    message: 'Conversation unassigned successfully',
                    conversationId: result.conversationId,
                });
            }

            case 'bulk_assign': {
                if (!body.conversationIds || body.conversationIds.length === 0) {
                    return NextResponse.json(
                        { error: 'conversationIds array is required' },
                        { status: 400 }
                    );
                }
                if (!body.assignedToId) {
                    return NextResponse.json(
                        { error: 'assignedToId is required' },
                        { status: 400 }
                    );
                }

                const result = await sharedInboxService.bulkAssignConversations(
                    body.conversationIds,
                    auth.user.userId,
                    body.assignedToId,
                    body.notes
                );

                return NextResponse.json({
                    success: true,
                    message: `Bulk assignment completed: ${result.success} successful, ${result.failed} failed`,
                    assigned: result.success,
                    failed: result.failed,
                    errors: result.errors,
                });
            }

            default:
                return NextResponse.json(
                    { error: `Unknown action: ${body.action}` },
                    { status: 400 }
                );
        }
    } catch (error) {
        console.error('[SharedInbox API] POST error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Internal error' },
            { status: 500 }
        );
    }
}
