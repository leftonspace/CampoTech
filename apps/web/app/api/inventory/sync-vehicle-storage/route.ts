/**
 * Sync Vehicle Storage API
 * POST /api/inventory/sync-vehicle-storage
 * Creates warehouse storage locations for all existing vehicles in the fleet.
 */

import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { syncAllVehicleWarehouses } from '@/lib/services/vehicle-storage';

export async function POST() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Only OWNER and ADMIN can sync vehicle storage
    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para sincronizar almacenes de vehÃ­culos' },
        { status: 403 }
      );
    }

    const result = await syncAllVehicleWarehouses(session.organizationId);

    return NextResponse.json({
      success: true,
      data: result,
      message: `Se crearon ${result.created} almacenes de vehÃ­culos. ${result.skipped} ya existÃ­an.`,
    });
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown error');
    console.error('Sync vehicle storage error:', err.message);
    return NextResponse.json(
      { success: false, error: 'Error sincronizando almacenes de vehÃ­culos' },
      { status: 500 }
    );
  }
}

