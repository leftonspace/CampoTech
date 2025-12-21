/**
 * WhatsApp Usage API
 * ==================
 *
 * GET /api/whatsapp/usage - Get usage statistics
 * GET /api/whatsapp/usage?history=30 - Get usage history for past N days
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  WhatsAppUsageService,
  formatUsageStats,
  getUpgradeSuggestion,
} from '@/lib/services/whatsapp-usage.service';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check for history parameter
    const { searchParams } = new URL(request.url);
    const historyDays = searchParams.get('history');

    if (historyDays) {
      // Return usage history
      const days = Math.min(Math.max(parseInt(historyDays, 10) || 30, 1), 90);
      const history = await WhatsAppUsageService.getUsageHistory(
        session.organizationId,
        days
      );

      return NextResponse.json({
        history,
        days,
      });
    }

    // Get current usage stats
    const stats = await WhatsAppUsageService.getUsageStats(session.organizationId);
    const formatted = formatUsageStats(stats);

    // Get current tier from stats context
    const { prisma } = await import('@/lib/prisma');
    const org = await prisma.organization.findUnique({
      where: { id: session.organizationId },
      select: {
        subscription: {
          select: { tier: true },
        },
      },
    });
    const currentTier = org?.subscription?.tier || 'FREE';
    const upgrade = getUpgradeSuggestion(currentTier);

    return NextResponse.json({
      stats: {
        ...stats,
        ...formatted,
      },
      tier: currentTier,
      tierLimits: WhatsAppUsageService.getTierLimits(currentTier),
      upgrade: stats.alertLevel || stats.limitReached ? upgrade : null,
    });
  } catch (error) {
    console.error('[Usage API] Error:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
