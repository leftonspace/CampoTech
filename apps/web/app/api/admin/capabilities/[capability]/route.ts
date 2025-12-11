/**
 * Admin Capability Toggle API
 * ===========================
 *
 * PATCH: Toggle a specific capability on/off
 * DELETE: Remove override (revert to default)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  getCapabilityService,
  CapabilityPath,
} from '../../../../../../../core/config/capabilities';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { capability: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (session.role !== 'admin' && session.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado - Se requiere rol de administrador' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { enabled, reason, global = false } = body;

    // Decode the capability path (it comes URL encoded with dots as %2E)
    const capabilityPath = decodeURIComponent(params.capability) as CapabilityPath;

    const service = getCapabilityService();

    const override = await service.setOverride({
      org_id: global ? null : session.organizationId,
      capability_path: capabilityPath,
      enabled: Boolean(enabled),
      reason: reason || (enabled ? 'Activado manualmente' : 'Desactivado manualmente'),
    }, session.userId);

    if (!override) {
      return NextResponse.json(
        { success: false, error: 'No se pudo guardar el cambio. Verifique la configuración de base de datos.' },
        { status: 500 }
      );
    }

    // Get Spanish name for the capability
    const capName = capabilityPath.split('.')[1].replace(/_/g, ' ');

    return NextResponse.json({
      success: true,
      data: override,
      message: enabled
        ? `${capName} activado correctamente`
        : `${capName} desactivado correctamente`,
    });
  } catch (error) {
    console.error('Error toggling capability:', error);
    return NextResponse.json(
      { success: false, error: 'Error al cambiar capacidad' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { capability: string } }
) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    // Check if user has admin role
    if (session.role !== 'admin' && session.role !== 'owner') {
      return NextResponse.json(
        { success: false, error: 'Acceso denegado - Se requiere rol de administrador' },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const global = searchParams.get('global') === 'true';

    // Decode the capability path
    const capabilityPath = decodeURIComponent(params.capability) as CapabilityPath;

    const service = getCapabilityService();

    const success = await service.removeOverride(
      capabilityPath,
      global ? undefined : session.organizationId
    );

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'No se encontró override para eliminar' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Override eliminado, volviendo al valor por defecto',
    });
  } catch (error) {
    console.error('Error removing capability override:', error);
    return NextResponse.json(
      { success: false, error: 'Error al eliminar override' },
      { status: 500 }
    );
  }
}
