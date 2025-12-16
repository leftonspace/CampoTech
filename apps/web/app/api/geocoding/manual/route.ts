/**
 * Manual Coordinate Setting API
 * POST /api/geocoding/manual
 *
 * Allows admins to manually set coordinates for an entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { setManualCoordinates } from '@/lib/services/geocoding';

interface ManualCoordinatesBody {
  entityType: 'customer' | 'job' | 'location';
  entityId: string;
  lat: number;
  lng: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only admins and owners can manually set coordinates
    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta acción' },
        { status: 403 }
      );
    }

    const body: ManualCoordinatesBody = await request.json();

    // Validate input
    if (!body.entityType || !body.entityId || body.lat === undefined || body.lng === undefined) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    // Validate coordinates are within reasonable bounds
    if (body.lat < -90 || body.lat > 90 || body.lng < -180 || body.lng > 180) {
      return NextResponse.json(
        { success: false, error: 'Coordenadas inválidas' },
        { status: 400 }
      );
    }

    const success = await setManualCoordinates(
      body.entityType,
      body.entityId,
      body.lat,
      body.lng
    );

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Coordenadas actualizadas correctamente',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'Error al actualizar coordenadas' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Manual coordinates error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
