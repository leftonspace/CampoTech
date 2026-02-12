/**
 * Phase 6.2: Shared Inbox Service
 * ================================
 * 
 * Manages team-based WhatsApp conversation assignments:
 * - Assign conversations to team members
 * - Track assignment history
 * - Filter conversations by agent
 * - Role-based visibility (Owner/ADMIN sees all, Technicians see assigned only)
 * 
 * Use Case: A company has ONE WhatsApp number, but multiple team members
 * need to see and respond to incoming messages.
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

// Inbox roles for conversation visibility
type InboxRole = 'owner' | 'admin' | 'agent' | 'viewer';

// User role to inbox role mapping
const INBOX_ROLE_MAP: Record<string, InboxRole> = {
    'OWNER': 'owner',
    'ADMIN': 'admin',
    'TECHNICIAN': 'agent',
};

export interface AssignmentResult {
    success: boolean;
    conversationId?: string;
    assignedToId?: string;
    error?: string;
}

export interface ConversationAssignment {
    id: string;
    customerPhone: string;
    customerName: string | null;
    assignedToId: string | null;
    assignedToName: string | null;
    status: string;
    unreadCount: number;
    lastMessageAt: Date;
    lastMessagePreview: string | null;
}

export interface InboxStats {
    total: number;
    unassigned: number;
    assignedToMe: number;
    open: number;
    closed: number;
    byAgent: Record<string, number>;
}

export interface AssignmentHistoryEntry {
    id: string;
    conversationId: string;
    assignedById: string;
    assignedByName: string;
    assignedToId: string | null;
    assignedToName: string | null;
    action: 'assigned' | 'unassigned' | 'transferred';
    notes?: string;
    createdAt: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SHARED INBOX SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

class SharedInboxService {

    // ─────────────────────────────────────────────────────────────────────────────
    // ROLE HELPERS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Get inbox role from user role
     */
    getInboxRole(userRole: string): InboxRole {
        return INBOX_ROLE_MAP[userRole.toUpperCase()] || 'viewer';
    }

    /**
     * Check if user can see all conversations (not just assigned)
     */
    canSeeAllConversations(role: InboxRole): boolean {
        return role === 'owner' || role === 'admin';
    }

    /**
     * Check if user can assign conversations
     */
    canAssignConversations(role: InboxRole): boolean {
        return role === 'owner' || role === 'admin';
    }

    /**
     * Check if user can respond to conversations
     */
    canRespondToConversations(role: InboxRole): boolean {
        return role !== 'viewer';
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // ASSIGNMENT OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Assign a conversation to a team member
     */
    async assignConversation(
        conversationId: string,
        assignedById: string,
        assignedToId: string,
        notes?: string
    ): Promise<AssignmentResult> {
        try {
            // Get conversation
            const conversation = await prisma.waConversation.findUnique({
                where: { id: conversationId },
                include: { assignedTo: { select: { id: true, name: true } } },
            });

            if (!conversation) {
                return { success: false, error: 'Conversation not found' };
            }

            // Get assigned-by user
            const assignedByUser = await prisma.user.findUnique({
                where: { id: assignedById },
                select: { id: true, name: true, organizationId: true, role: true },
            });

            if (!assignedByUser) {
                return { success: false, error: 'Assigning user not found' };
            }

            // Check permissions
            const inboxRole = this.getInboxRole(assignedByUser.role);
            if (!this.canAssignConversations(inboxRole)) {
                return { success: false, error: 'User not authorized to assign conversations' };
            }

            // Get target user
            const assignedToUser = await prisma.user.findUnique({
                where: { id: assignedToId },
                select: { id: true, name: true, organizationId: true },
            });

            if (!assignedToUser) {
                return { success: false, error: 'Target user not found' };
            }

            // Verify target user is in the same organization
            if (assignedToUser.organizationId !== conversation.organizationId) {
                return { success: false, error: 'Target user is not in this organization' };
            }

            const previousAssigneeId = conversation.assignedToId;

            // Update conversation assignment
            await prisma.waConversation.update({
                where: { id: conversationId },
                data: {
                    assignedToId: assignedToId,
                },
            });

            // Log assignment history
            await this.logAssignmentHistory({
                conversationId,
                assignedById,
                assignedByName: assignedByUser.name,
                assignedToId,
                assignedToName: assignedToUser.name,
                action: previousAssigneeId ? 'transferred' : 'assigned',
                notes,
            });

            return {
                success: true,
                conversationId,
                assignedToId,
            };
        } catch (error) {
            console.error('[SharedInbox] Error assigning conversation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Unassign a conversation (move to unassigned queue)
     */
    async unassignConversation(
        conversationId: string,
        unassignedById: string,
        notes?: string
    ): Promise<AssignmentResult> {
        try {
            const conversation = await prisma.waConversation.findUnique({
                where: { id: conversationId },
                include: { assignedTo: { select: { id: true, name: true } } },
            });

            if (!conversation) {
                return { success: false, error: 'Conversation not found' };
            }

            if (!conversation.assignedToId) {
                return { success: false, error: 'Conversation is not assigned' };
            }

            // Get unassigning user
            const unassignedByUser = await prisma.user.findUnique({
                where: { id: unassignedById },
                select: { id: true, name: true, role: true },
            });

            if (!unassignedByUser) {
                return { success: false, error: 'User not found' };
            }

            // Check permissions - allow self-unassign or admin unassign
            const inboxRole = this.getInboxRole(unassignedByUser.role);
            const isSelfUnassign = conversation.assignedToId === unassignedById;

            if (!isSelfUnassign && !this.canAssignConversations(inboxRole)) {
                return { success: false, error: 'User not authorized to unassign conversations' };
            }

            // Clear assignment
            await prisma.waConversation.update({
                where: { id: conversationId },
                data: { assignedToId: null },
            });

            // Log history
            await this.logAssignmentHistory({
                conversationId,
                assignedById: unassignedById,
                assignedByName: unassignedByUser.name,
                assignedToId: null,
                assignedToName: null,
                action: 'unassigned',
                notes: notes || `Unassigned from ${conversation.assignedTo?.name || 'unknown'}`,
            });

            return { success: true, conversationId };
        } catch (error) {
            console.error('[SharedInbox] Error unassigning conversation:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Bulk assign conversations
     */
    async bulkAssignConversations(
        conversationIds: string[],
        assignedById: string,
        assignedToId: string,
        notes?: string
    ): Promise<{ success: number; failed: number; errors: string[] }> {
        const results = { success: 0, failed: 0, errors: [] as string[] };

        for (const conversationId of conversationIds) {
            const result = await this.assignConversation(
                conversationId,
                assignedById,
                assignedToId,
                notes
            );

            if (result.success) {
                results.success++;
            } else {
                results.failed++;
                results.errors.push(`${conversationId}: ${result.error}`);
            }
        }

        return results;
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // QUERY OPERATIONS
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Get conversations for a user based on their role
     */
    async getConversationsForUser(
        userId: string,
        options: {
            filter?: 'all' | 'assigned_to_me' | 'unassigned' | 'open' | 'closed';
            limit?: number;
            offset?: number;
        } = {}
    ): Promise<ConversationAssignment[]> {
        const { filter = 'all', limit = 50, offset = 0 } = options;

        // Get user with role
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: { id: true, role: true, organizationId: true },
        });

        if (!user) {
            throw new Error('User not found');
        }

        const inboxRole = this.getInboxRole(user.role);
        const canSeeAll = this.canSeeAllConversations(inboxRole);

        // Build where clause
        const where: Record<string, unknown> = {
            organizationId: user.organizationId,
        };

        // Apply visibility constraints
        if (!canSeeAll) {
            // Technicians only see assigned conversations
            where.assignedToId = userId;
        }

        // Apply filter
        switch (filter) {
            case 'assigned_to_me':
                where.assignedToId = userId;
                break;
            case 'unassigned':
                if (canSeeAll) {
                    where.assignedToId = null;
                }
                break;
            case 'open':
                where.status = 'OPEN';
                break;
            case 'closed':
                where.status = 'CLOSED';
                break;
        }

        const conversations = await prisma.waConversation.findMany({
            where,
            include: {
                assignedTo: { select: { id: true, name: true } },
            },
            orderBy: { lastMessageAt: 'desc' },
            take: limit,
            skip: offset,
        });

        return conversations.map((c: { id: string; customerPhone: string; customerName: string | null; assignedToId: string | null; assignedTo: { id: string; name: string } | null; status: string; unreadCount: number; lastMessageAt: Date; lastMessagePreview: string | null }) => ({
            id: c.id,
            customerPhone: c.customerPhone,
            customerName: c.customerName,
            assignedToId: c.assignedToId,
            assignedToName: c.assignedTo?.name || null,
            status: c.status,
            unreadCount: c.unreadCount,
            lastMessageAt: c.lastMessageAt,
            lastMessagePreview: c.lastMessagePreview,
        }));
    }

    /**
     * Get inbox statistics for an organization
     */
    async getInboxStats(organizationId: string, userId?: string): Promise<InboxStats> {
        const [
            total,
            unassigned,
            open,
            closed,
            byAgent,
            assignedToMe,
        ] = await Promise.all([
            // Total conversations
            prisma.waConversation.count({
                where: { organizationId },
            }),
            // Unassigned
            prisma.waConversation.count({
                where: { organizationId, assignedToId: null, status: 'OPEN' },
            }),
            // Open
            prisma.waConversation.count({
                where: { organizationId, status: 'OPEN' },
            }),
            // Closed
            prisma.waConversation.count({
                where: { organizationId, status: 'CLOSED' },
            }),
            // By agent - group by assignedToId
            prisma.waConversation.groupBy({
                by: ['assignedToId'],
                where: { organizationId, assignedToId: { not: null } },
                _count: { _all: true },
            }),
            // Assigned to current user
            userId
                ? prisma.waConversation.count({
                    where: { organizationId, assignedToId: userId, status: 'OPEN' },
                })
                : 0,
        ]);

        // Convert by-agent to record
        const byAgentRecord: Record<string, number> = {};
        for (const entry of byAgent) {
            if (entry.assignedToId) {
                byAgentRecord[entry.assignedToId] = (entry._count as { _all: number })._all;
            }
        }

        return {
            total,
            unassigned,
            assignedToMe,
            open,
            closed,
            byAgent: byAgentRecord,
        };
    }

    /**
     * Get team members who can be assigned conversations
     */
    async getAssignableTeamMembers(organizationId: string): Promise<{
        id: string;
        name: string;
        role: string;
        activeConversations: number;
    }[]> {
        const members = await prisma.user.findMany({
            where: {
                organizationId,
                isActive: true,
            },
            select: {
                id: true,
                name: true,
                role: true,
                _count: {
                    select: {
                        assignedWaConversations: {
                            where: { status: 'OPEN' },
                        },
                    },
                },
            },
            orderBy: { name: 'asc' },
        });

        return members.map((m: { id: string; name: string; role: string; _count: { assignedWaConversations: number } }) => ({
            id: m.id,
            name: m.name,
            role: m.role,
            activeConversations: m._count.assignedWaConversations,
        }));
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // HISTORY & AUDIT
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Log assignment history entry
     */
    private async logAssignmentHistory(entry: Omit<AssignmentHistoryEntry, 'id' | 'createdAt'>): Promise<void> {
        // Store as an event in the events table
        await prisma.event.create({
            data: {
                type: 'conversation_assignment',
                description: `Conversation ${entry.action}: ${entry.assignedByName} ${entry.action} conversation to ${entry.assignedToName || 'unassigned'}`,
                payload: {
                    conversationId: entry.conversationId,
                    assignedById: entry.assignedById,
                    assignedByName: entry.assignedByName,
                    assignedToId: entry.assignedToId,
                    assignedToName: entry.assignedToName,
                    action: entry.action,
                    notes: entry.notes,
                },
                severity: 'info',
            },
        });
    }

    /**
     * Get assignment history for a conversation
     */
    async getAssignmentHistory(conversationId: string): Promise<AssignmentHistoryEntry[]> {
        const events = await prisma.event.findMany({
            where: {
                type: 'conversation_assignment',
            },
            orderBy: { createdAt: 'desc' },
            take: 50,
        });

        // Filter events for this conversation and map to history entries
        type EventEntry = { id: string; payload: unknown; createdAt: Date };
        return (events as EventEntry[])
            .filter((e: EventEntry) => {
                const payload = e.payload as Record<string, unknown> | null;
                return payload && payload.conversationId === conversationId;
            })
            .map((e: EventEntry) => {
                const payload = e.payload as Record<string, unknown>;
                return {
                    id: e.id,
                    conversationId: payload.conversationId as string,
                    assignedById: payload.assignedById as string,
                    assignedByName: payload.assignedByName as string,
                    assignedToId: payload.assignedToId as string | null,
                    assignedToName: payload.assignedToName as string | null,
                    action: payload.action as 'assigned' | 'unassigned' | 'transferred',
                    notes: payload.notes as string | undefined,
                    createdAt: e.createdAt,
                };
            });
    }

    // ─────────────────────────────────────────────────────────────────────────────
    // AGENT PERFORMANCE
    // ─────────────────────────────────────────────────────────────────────────────

    /**
     * Get agent performance metrics
     */
    async getAgentPerformance(
        organizationId: string,
        startDate?: Date,
        endDate?: Date
    ): Promise<{
        agentId: string;
        agentName: string;
        conversationsHandled: number;
        messagesSent: number;
        avgResponseTimeMinutes: number;
    }[]> {
        const dateFilter = {
            createdAt: {
                ...(startDate && { gte: startDate }),
                ...(endDate && { lte: endDate }),
            },
        };

        // Get all agents in the organization
        const agents = await prisma.user.findMany({
            where: { organizationId, isActive: true },
            select: { id: true, name: true },
        });

        const performance = await Promise.all(
            agents.map(async (agent: { id: string; name: string }) => {
                const [conversationsHandled, messagesSent] = await Promise.all([
                    // Conversations where this agent was assigned
                    prisma.waConversation.count({
                        where: {
                            organizationId,
                            assignedToId: agent.id,
                            ...dateFilter,
                        },
                    }),
                    // Messages sent by this agent
                    prisma.waMessage.count({
                        where: {
                            organizationId,
                            sentById: agent.id,
                            direction: 'outbound',
                            ...dateFilter,
                        },
                    }),
                ]);

                return {
                    agentId: agent.id,
                    agentName: agent.name,
                    conversationsHandled,
                    messagesSent,
                    avgResponseTimeMinutes: 0, // TODO: Calculate from message timestamps
                };
            })
        );

        return performance.filter((p) => p.conversationsHandled > 0 || p.messagesSent > 0);
    }
}

// Export singleton instance
export const sharedInboxService = new SharedInboxService();
