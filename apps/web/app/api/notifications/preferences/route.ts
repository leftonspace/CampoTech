import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getUserPreferences,
  updateUserPreferences,
  createDefaultPreferences,
} from '@/../../src/modules/notifications/notification.service';

/**
 * GET /api/notifications/preferences
 * Get current user's notification preferences
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

    const preferences = await getUserPreferences(session.userId);

    return NextResponse.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    console.error('Get notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo preferencias de notificaciones' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/notifications/preferences
 * Update current user's notification preferences
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

    // Validate input
    const validKeys = [
      'webEnabled',
      'pushEnabled',
      'smsEnabled',
      'emailEnabled',
      'whatsappEnabled',
      'eventPreferences',
      'reminderIntervals',
      'quietHoursEnabled',
      'quietHoursStart',
      'quietHoursEnd',
      'quietHoursTimezone',
    ];

    const updates: Record<string, any> = {};
    for (const key of validKeys) {
      if (body[key] !== undefined) {
        updates[key] = body[key];
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json(
        { success: false, error: 'No se proporcionaron actualizaciones válidas' },
        { status: 400 }
      );
    }

    await updateUserPreferences(session.userId, session.organizationId, updates);

    // Return updated preferences
    const updatedPreferences = await getUserPreferences(session.userId);

    return NextResponse.json({
      success: true,
      data: updatedPreferences,
      message: 'Preferencias actualizadas correctamente',
    });
  } catch (error) {
    console.error('Update notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando preferencias de notificaciones' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/notifications/preferences
 * Create default preferences for a user (admin action or first-time setup)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const targetUserId = body.userId || session.userId;

    // Only admins can create preferences for other users
    if (targetUserId !== session.userId && !['OWNER', 'ADMIN'].includes(session.role)) {
      return NextResponse.json(
        { success: false, error: 'Permisos insuficientes' },
        { status: 403 }
      );
    }

    await createDefaultPreferences(targetUserId, session.organizationId);

    const preferences = await getUserPreferences(targetUserId);

    return NextResponse.json({
      success: true,
      data: preferences,
      message: 'Preferencias creadas correctamente',
    });
  } catch (error) {
    console.error('Create notification preferences error:', error);
    return NextResponse.json(
      { success: false, error: 'Error creando preferencias de notificaciones' },
      { status: 500 }
    );
  }
}
