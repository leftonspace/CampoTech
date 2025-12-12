/**
 * User Data Export API
 * ====================
 *
 * POST /api/users/me/export - Request a new data export
 * GET /api/users/me/export - Get export request status
 *
 * Implements Right of Access per Ley 25.326
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { dataExporter } from '@/lib/services/data-exporter';

/**
 * POST /api/users/me/export
 * Request a new data export
 */
export async function POST(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { userId, organizationId } = session;

    // Create export request
    const result = await dataExporter.createExportRequest(userId, organizationId);

    if (!result.success) {
      return NextResponse.json(
        { error: 'rate_limited', message: result.error },
        { status: 429 }
      );
    }

    // In a real implementation, this would trigger a background job
    // For now, process synchronously (not recommended for production)
    // TODO: Queue this with BullMQ
    const processResult = await dataExporter.processExportRequest(result.requestId!);

    if (!processResult.success) {
      return NextResponse.json(
        { error: 'processing_failed', message: processResult.error },
        { status: 500 }
      );
    }

    // Get updated status
    const exportRequest = await dataExporter.getExportStatus(result.requestId!, userId);

    return NextResponse.json({
      success: true,
      message: 'Tu solicitud de exportación ha sido procesada.',
      export: {
        id: exportRequest?.id,
        status: exportRequest?.status,
        downloadUrl: exportRequest?.downloadUrl,
        expiresAt: exportRequest?.expiresAt?.toISOString(),
      },
    });
  } catch (error) {
    console.error('Export request error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al procesar la solicitud' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/users/me/export
 * Get current export request status
 */
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { error: 'unauthorized', message: 'No autorizado' },
        { status: 401 }
      );
    }

    const { userId } = session;

    // Get latest export request
    const exportRequest = await dataExporter.getLatestExportRequest(userId);

    if (!exportRequest) {
      return NextResponse.json({
        hasExport: false,
        message: 'No hay solicitudes de exportación.',
      });
    }

    // Check if expired
    if (exportRequest.status === 'completed' && exportRequest.expiresAt) {
      if (new Date(exportRequest.expiresAt) < new Date()) {
        return NextResponse.json({
          hasExport: true,
          export: {
            id: exportRequest.id,
            status: 'expired',
            requestedAt: exportRequest.requestedAt.toISOString(),
            message: 'La exportación ha expirado. Solicita una nueva.',
          },
        });
      }
    }

    return NextResponse.json({
      hasExport: true,
      export: {
        id: exportRequest.id,
        status: exportRequest.status,
        requestedAt: exportRequest.requestedAt.toISOString(),
        completedAt: exportRequest.completedAt?.toISOString(),
        downloadUrl: exportRequest.status === 'completed' ? exportRequest.downloadUrl : undefined,
        expiresAt: exportRequest.expiresAt?.toISOString(),
        errorMessage: exportRequest.errorMessage,
      },
    });
  } catch (error) {
    console.error('Export status error:', error);
    return NextResponse.json(
      { error: 'internal_error', message: 'Error al obtener el estado' },
      { status: 500 }
    );
  }
}
