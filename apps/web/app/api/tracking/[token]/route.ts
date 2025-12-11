/**
 * Tracking Token API Route
 * Self-contained implementation (placeholder)
 */

import { NextRequest, NextResponse } from 'next/server';

interface RouteParams {
  params: Promise<{ token: string }>;
}

/**
 * GET /api/tracking/[token]
 * Public endpoint for customers to view tracking data
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { token } = await params;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'Token requerido' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { success: false, error: 'Token inválido o sesión expirada' },
      { status: 404 }
    );
  } catch (error) {
    console.error('Tracking view error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo datos de seguimiento' },
      { status: 500 }
    );
  }
}
