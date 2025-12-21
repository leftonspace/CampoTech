import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';

/**
 * Notifications API
 * =================
 * GET /api/notifications - Get user's notifications
 *
 * This is a placeholder until the full notification system is implemented.
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
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);

    // TODO: Implement actual notification fetching from database
    // For now, return empty list to prevent console errors
    return NextResponse.json({
      success: true,
      data: [],
      unreadCount: 0,
      pagination: {
        total: 0,
        limit,
        hasMore: false,
      },
    });
  } catch (error) {
    console.error('Get notifications error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo notificaciones' },
      { status: 500 }
    );
  }
}
