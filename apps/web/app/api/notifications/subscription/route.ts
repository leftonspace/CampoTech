/**
 * Subscription Notifications API
 * ==============================
 *
 * GET /api/notifications/subscription - Get subscription notifications
 * PUT /api/notifications/subscription - Mark notifications as read
 *
 * Provides subscription-related in-app notifications for the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getSubscriptionNotifications,
  markNotificationsAsRead,
} from '@/lib/notifications/subscription-notifications';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Subscription Notifications
// ═══════════════════════════════════════════════════════════════════════════════

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get('unreadOnly') === 'true';
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    const { notifications, unreadCount } = await getSubscriptionNotifications(
      session.organizationId,
      {
        unreadOnly,
        limit,
        offset,
      }
    );

    return NextResponse.json({
      success: true,
      data: {
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          actionUrl: n.actionUrl,
          actionLabel: n.actionLabel,
          severity: n.severity,
          read: n.read,
          createdAt: n.createdAt.toISOString(),
        })),
        unreadCount,
        pagination: {
          limit,
          offset,
          hasMore: notifications.length === limit,
        },
      },
    });
  } catch (error) {
    console.error('[SubscriptionNotifications] GET error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo notificaciones' },
      { status: 500 }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// PUT - Mark Notifications as Read
// ═══════════════════════════════════════════════════════════════════════════════

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => ({}));
    const { notificationIds } = body as { notificationIds?: string[] };

    const markedCount = await markNotificationsAsRead(
      session.organizationId,
      notificationIds
    );

    return NextResponse.json({
      success: true,
      data: {
        markedCount,
        message: notificationIds
          ? `Marcadas ${markedCount} notificaciones como leídas`
          : 'Todas las notificaciones marcadas como leídas',
      },
    });
  } catch (error) {
    console.error('[SubscriptionNotifications] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Error marcando notificaciones' },
      { status: 500 }
    );
  }
}
