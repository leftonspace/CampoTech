/**
 * WhatsApp Queue API
 * ==================
 *
 * GET /api/whatsapp/queue - Get queue status and statistics
 * POST /api/whatsapp/queue - Enqueue a message
 * DELETE /api/whatsapp/queue - Cancel a queued message
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getQueueStats,
  queueTextMessage,
  queueTemplateMessage,
  cancelQueuedMessage,
  checkRateLimit,
} from '@/lib/integrations/whatsapp';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId =
      request.nextUrl.searchParams.get('organizationId') || session.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    // Get queue statistics
    const stats = await getQueueStats(organizationId);

    // Get rate limit status
    const rateLimit = checkRateLimit(organizationId);

    return NextResponse.json({
      queue: {
        totalQueued: stats.totalQueued,
        byPriority: stats.byPriority,
        byStatus: stats.byStatus,
        sentLastMinute: stats.sentLastMinute,
        sentLastHour: stats.sentLastHour,
        currentRate: stats.currentRate,
        avgWaitTime: stats.avgWaitTime,
        health: stats.health,
      },
      rateLimit: {
        canSend: rateLimit.canSend,
        waitTimeMs: rateLimit.waitTimeMs,
        orgCount: rateLimit.orgCount,
        globalCapacity: rateLimit.globalCapacity,
      },
    });
  } catch (error) {
    console.error('[WA Queue API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      organizationId: bodyOrgId,
      phone,
      type,
      text,
      templateName,
      templateLanguage,
      templateParams,
      priority,
      customerId,
    } = body;

    const organizationId = bodyOrgId || session.organizationId;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      );
    }

    if (!phone) {
      return NextResponse.json({ error: 'Phone number required' }, { status: 400 });
    }

    // Check rate limit before queueing
    const rateLimit = checkRateLimit(organizationId);
    if (!rateLimit.canSend && rateLimit.waitTimeMs > 60000) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          waitTimeMs: rateLimit.waitTimeMs,
        },
        { status: 429 }
      );
    }

    let result;

    if (type === 'template' && templateName) {
      result = await queueTemplateMessage(
        organizationId,
        phone,
        templateName,
        templateLanguage || 'es_AR',
        {
          customerId,
          priority: priority || 'high',
          parameters: templateParams,
        }
      );
    } else if (type === 'text' && text) {
      result = await queueTextMessage(organizationId, phone, text, {
        customerId,
        priority: priority || 'normal',
      });
    } else {
      return NextResponse.json(
        { error: 'Invalid message type or missing content' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId: result.messageId,
      queuePosition: result.queuePosition,
      estimatedWait: rateLimit.waitTimeMs,
    });
  } catch (error) {
    console.error('[WA Queue API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to queue message' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const messageId = request.nextUrl.searchParams.get('messageId');
    if (!messageId) {
      return NextResponse.json({ error: 'Message ID required' }, { status: 400 });
    }

    const cancelled = await cancelQueuedMessage(messageId);

    if (!cancelled) {
      return NextResponse.json(
        { error: 'Message not found or already processed' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      messageId,
      status: 'cancelled',
    });
  } catch (error) {
    console.error('[WA Queue API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to cancel message' },
      { status: 500 }
    );
  }
}
