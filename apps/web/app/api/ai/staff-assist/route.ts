/**
 * AI Staff Assistant API
 * ======================
 *
 * Provides AI assistance to staff during WhatsApp conversations.
 *
 * POST /api/ai/staff-assist
 * Body: {
 *   conversationId: string,
 *   action: 'draft_response' | 'suggest_booking' | 'check_availability' | ...
 *   query?: string,
 *   context?: { ... }
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAIStaffAssistant, StaffAssistantAction } from '@/lib/services/ai-staff-assistant';
import { prisma } from '@/lib/prisma';
// Phase 8 Security: Rate limiting (P3)
import { checkCombinedAILimits, getRateLimitHeaders } from '@/lib/ai';

const VALID_ACTIONS: StaffAssistantAction[] = [
  'draft_response',
  'suggest_booking',
  'check_availability',
  'create_booking',
  'analyze_customer',
  'detect_conflicts',
  'lookup_pricing',
  'general_help',
];

export async function POST(req: NextRequest) {
  try {
    // Check authentication
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { conversationId, action, query, context } = body;

    // Phase 8 Security: Rate limit AI requests (P3)
    if (session.organizationId) {
      const rateLimit = await checkCombinedAILimits(session.userId, session.organizationId, 'staff_assist');
      if (!rateLimit.success) {
        return NextResponse.json(
          { error: rateLimit.error || 'Rate limit exceeded' },
          { status: 429, headers: getRateLimitHeaders(rateLimit) }
        );
      }
    }

    // Validate required fields
    if (!conversationId) {
      return NextResponse.json(
        { error: 'conversationId is required' },
        { status: 400 }
      );
    }

    if (!action || !VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `Invalid action. Valid actions: ${VALID_ACTIONS.join(', ')}` },
        { status: 400 }
      );
    }

    // Get conversation to verify organization access
    const conversation = await prisma.waConversation.findUnique({
      where: { id: conversationId },
      select: { organizationId: true },
    });

    if (!conversation) {
      return NextResponse.json(
        { error: 'Conversation not found' },
        { status: 404 }
      );
    }

    // Verify user has access to this organization
    const userOrg = await prisma.organizationMember.findFirst({
      where: {
        userId: session.userId,
        organizationId: conversation.organizationId,
      },
    });

    if (!userOrg) {
      return NextResponse.json(
        { error: 'Access denied to this conversation' },
        { status: 403 }
      );
    }

    // Process the request
    const assistant = getAIStaffAssistant();
    const result = await assistant.processRequest({
      organizationId: conversation.organizationId,
      conversationId,
      userId: session.userId,
      action: action as StaffAssistantAction,
      query,
      context,
    });

    // Log the assistance request for analytics
    await prisma.aIConversationLog.create({
      data: {
        organizationId: conversation.organizationId,
        conversationId,
        messageId: `staff-assist-${Date.now()}`,
        customerMessage: `[Staff Request] ${action}: ${query || 'N/A'}`,
        messageType: 'text',
        detectedIntent: action,
        confidenceScore: 100,
        aiResponse: result.result.substring(0, 500),
        responseStatus: result.success ? 'staff_assist' : 'error',
      },
    }).catch((err: Error) => {
      console.error('Failed to log staff assist:', err);
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Staff assist API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET - Quick actions info
 */
export async function GET() {
  return NextResponse.json({
    actions: VALID_ACTIONS.map(action => ({
      action,
      description: {
        draft_response: 'Generate a response draft for staff to review',
        suggest_booking: 'Analyze conversation and suggest booking steps',
        check_availability: 'Check technician availability for a date',
        create_booking: 'Create a booking (staff-initiated)',
        analyze_customer: 'Get customer insights and history',
        detect_conflicts: 'Detect conflicts in the conversation',
        lookup_pricing: 'Look up service pricing',
        general_help: 'Answer any general question',
      }[action],
    })),
    usage: {
      method: 'POST',
      body: {
        conversationId: 'string (required)',
        action: 'string (required)',
        query: 'string (optional)',
        context: 'object (optional)',
      },
    },
  });
}
