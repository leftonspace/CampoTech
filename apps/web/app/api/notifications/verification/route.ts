/**
 * Verification Notifications API
 * ===============================
 *
 * GET /api/notifications/verification - Get verification notifications
 * PUT /api/notifications/verification - Mark notifications as read
 *
 * Provides verification-related in-app notifications for the user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getVerificationNotifications,
  markVerificationNotificationsAsRead,
  getAllNotifications,
  markAllNotificationsAsRead,
} from '@/lib/notifications/verification-notifications';

// ═══════════════════════════════════════════════════════════════════════════════
// GET - Get Verification Notifications
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
    const includeAll = searchParams.get('includeAll') === 'true'; // Include subscription notifications
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 50);
    const offset = parseInt(searchParams.get('offset') || '0');

    if (includeAll) {
      // Get combined verification + subscription notifications
      const { notifications, unreadCount } = await getAllNotifications(
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
            category: (n as Record<string, unknown>).category || 'verification',
            title: (n as Record<string, unknown>).title || '',
            message: (n as Record<string, unknown>).message || '',
            actionUrl: (n as Record<string, unknown>).actionUrl,
            actionLabel: (n as Record<string, unknown>).actionLabel,
            severity: (n as Record<string, unknown>).severity || 'info',
            read: (n as Record<string, unknown>).read || false,
            createdAt: ((n as Record<string, unknown>).createdAt as Date)?.toISOString(),
          })),
          unreadCount,
          pagination: {
            limit,
            offset,
            hasMore: notifications.length === limit,
          },
        },
      });
    }

    // Get only verification notifications
    const { notifications, unreadCount } = await getVerificationNotifications(
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
    console.error('[VerificationNotifications] GET error:', error);
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
    const { notificationIds, markAll } = body as {
      notificationIds?: string[];
      markAll?: boolean; // Mark all notifications (verification + subscription)
    };

    let markedCount: number;

    if (markAll) {
      markedCount = await markAllNotificationsAsRead(session.organizationId);
    } else {
      markedCount = await markVerificationNotificationsAsRead(
        session.organizationId,
        notificationIds
      );
    }

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
    console.error('[VerificationNotifications] PUT error:', error);
    return NextResponse.json(
      { success: false, error: 'Error marcando notificaciones' },
      { status: 500 }
    );
  }
}
