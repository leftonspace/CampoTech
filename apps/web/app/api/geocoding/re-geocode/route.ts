/**
 * Re-Geocode API
 * POST /api/geocoding/re-geocode
 *
 * Triggers re-geocoding for a specific entity
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { triggerReGeocode } from '@/lib/services/geocoding';

interface ReGeocodeBody {
  entityType: 'customer' | 'job' | 'location';
  entityId: string;
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

    // Only admins, owners, and Admins can trigger re-geocoding
    if (!['OWNER', 'ADMIN'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para esta acción' },
        { status: 403 }
      );
    }

    const body: ReGeocodeBody = await request.json();

    // Validate input
    if (!body.entityType || !body.entityId) {
      return NextResponse.json(
        { success: false, error: 'Datos incompletos' },
        { status: 400 }
      );
    }

    const success = await triggerReGeocode(
      body.entityType,
      body.entityId,
      session.organizationId
    );

    if (success) {
      return NextResponse.json({
        success: true,
        message: 'Geocodificación iniciada',
      });
    } else {
      return NextResponse.json(
        { success: false, error: 'No se pudo iniciar la geocodificación. Verifica que la entidad tenga una dirección válida.' },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('Re-geocode error:', error);
    return NextResponse.json(
      { success: false, error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
