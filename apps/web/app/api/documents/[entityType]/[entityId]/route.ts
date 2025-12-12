/**
 * Document Versions API
 * GET /api/documents/[entityType]/[entityId] - Get document version history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { documentVersioning } from '@/lib/services/document-versioning';

interface RouteParams {
  params: Promise<{ entityType: string; entityId: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse> {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json(
        { success: false, error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { entityType, entityId } = await params;
    const { searchParams } = new URL(request.url);
    const documentType = searchParams.get('documentType');

    // Validate entity type
    if (!['vehicle', 'organization', 'user'].includes(entityType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de entidad invalido' },
        { status: 400 }
      );
    }

    // Get version history
    const versions = await documentVersioning.getVersionHistory(
      entityType as 'vehicle' | 'organization' | 'user',
      entityId,
      documentType || undefined
    );

    // Get current version
    const current = await documentVersioning.getCurrentVersion(
      entityType as 'vehicle' | 'organization' | 'user',
      entityId,
      documentType || undefined
    );

    return NextResponse.json({
      success: true,
      data: {
        current,
        versions,
        totalVersions: versions.length,
      },
    });
  } catch (error) {
    console.error('Get document versions error:', error);
    return NextResponse.json(
      { success: false, error: 'Error obteniendo historial de documentos' },
      { status: 500 }
    );
  }
}
