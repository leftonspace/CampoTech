import { NextRequest, NextResponse } from 'next/server';
import {
  getCustomerTrackingView,
  validateToken,
} from '@/../../src/modules/tracking/tracking.service';

/**
 * GET /api/tracking/[token]
 * Public endpoint for customers to view tracking data
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { token: string } }
) {
  try {
    const { token } = params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      );
    }

    // Validate token
    const validation = await validateToken(token);

    if (!validation.valid) {
      return NextResponse.json(
        { success: false, error: validation.error || 'Token inválido' },
        { status: 401 }
      );
    }

    // Get tracking view data
    const trackingData = await getCustomerTrackingView(token);

    if (!trackingData) {
      return NextResponse.json(
        { success: false, error: 'Sesión de seguimiento no encontrada' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: trackingData,
    });
  } catch (error) {
    console.error('Tracking view error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo datos de seguimiento' },
      { status: 500 }
    );
  }
}
