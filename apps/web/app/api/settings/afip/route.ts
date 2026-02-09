/**
 * AFIP Settings API Route
 * GET /api/settings/afip - Get AFIP configuration status
 * PUT /api/settings/afip - Update AFIP configuration (with encrypted storage)
 *
 * Phase 1.1 Security Fix: AFIP credentials now stored encrypted with AES-256-GCM
 * @see apps/web/lib/services/afip-credentials.service.ts
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getAFIPCredentialsService } from '@/lib/services/afip-credentials.service';
import { validateBody, afipSettingsSchema } from '@/lib/validation/api-schemas';

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const afipService = getAFIPCredentialsService();
    const status = await afipService.getConfigurationStatus(session.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        isConfigured: status.isConfigured,
        cuit: status.cuit || '',
        puntoVenta: status.puntoVenta || '',
        environment: status.environment,
        hasCertificate: status.hasCertificate,
        hasPrivateKey: status.hasPrivateKey,
        connectedAt: status.connectedAt?.toISOString() || null,
      },
    });
  } catch (error) {
    console.error('Get AFIP settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo configuración AFIP' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    if (!['OWNER'].includes(session.role.toUpperCase())) {
      return NextResponse.json(
        { success: false, error: 'No tienes permiso para editar configuración AFIP' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Validate request body with Zod
    const validation = validateBody(body, afipSettingsSchema);
    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: validation.error },
        { status: 400 }
      );
    }

    const { cuit, puntoVenta, environment, certificate, privateKey } = validation.data;

    const afipService = getAFIPCredentialsService();

    // Save credentials with encryption
    await afipService.saveCredentials(session.organizationId, {
      cuit: cuit ?? '',
      certificate: certificate ?? '',
      privateKey: privateKey ?? '',
      puntoVenta: puntoVenta ?? '',
      environment: environment ?? 'testing',
    });

    // Get updated status
    const status = await afipService.getConfigurationStatus(session.organizationId);

    return NextResponse.json({
      success: true,
      data: {
        isConfigured: status.isConfigured,
        cuit: status.cuit || '',
        puntoVenta: status.puntoVenta || '',
        environment: status.environment,
        hasCertificate: status.hasCertificate,
        hasPrivateKey: status.hasPrivateKey,
      },
      message: 'Configuración AFIP actualizada correctamente',
    });
  } catch (error) {
    console.error('Update AFIP settings error:', error);
    return NextResponse.json(
      { success: false, error: 'Error actualizando configuración AFIP' },
      { status: 500 }
    );
  }
}
