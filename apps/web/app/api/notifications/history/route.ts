import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * GET /api/notifications/history
 * Get notification history for current user
 */
export async function GET(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(parseInt(searchParams.get('limit') || '50'), 100);
    const offset = parseInt(searchParams.get('offset') || '0');
    const status = searchParams.get('status'); // pending, sent, delivered, failed, read
    const channel = searchParams.get('channel'); // web, push, sms, email, whatsapp
    const unreadOnly = searchParams.get('unread') === 'true';

    const where: any = {
      userId: session.userId,
      organizationId: session.organizationId,
    };

    if (status) {
      where.status = status;
    }

    if (channel) {
      where.channel = channel;
    }

    if (unreadOnly) {
      where.readAt = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      prisma.notificationLogs.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          eventType: true,
          channel: true,
          title: true,
          body: true,
          status: true,
          sentAt: true,
          readAt: true,
          entityType: true,
          entityId: true,
          createdAt: true,
        },
      }),
      prisma.notificationLogs.count({ where }),
      prisma.notificationLogs.count({
        where: {
          userId: session.userId,
          organizationId: session.organizationId,
          readAt: null,
        },
      }),
    ]);

    return NextResponse.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
      unreadCount,
    });
  } catch (error) {
    console.error('Get notification history error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo historial de notificaciones' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/history
 * Mark notifications as read
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { notificationIds, markAllRead } = body;

    if (markAllRead) {
      // Mark all unread notifications as read
      await prisma.notificationLogs.updateMany({
        where: {
          userId: session.userId,
          organizationId: session.organizationId,
          readAt: null,
        },
        data: {
          readAt: new Date(),
          status: 'read',
        },
      });

      return NextResponse.json({
        success: true,
        message: 'Todas las notificaciones marcadas como leídas',
      });
    }

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'Se requieren IDs de notificaciones' },
        { status: 400 }
      );
    }

    // Mark specific notifications as read
    await prisma.notificationLogs.updateMany({
      where: {
        id: { in: notificationIds },
        userId: session.userId,
        organizationId: session.organizationId,
      },
      data: {
        readAt: new Date(),
        status: 'read',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Notificaciones marcadas como leídas',
    });
  } catch (error) {
    console.error('Mark notifications read error:', error);
    return NextResponse.json(
      { success: false, error: 'Error marcando notificaciones como leídas' },
      { status: 500 }
    );
  }
}
