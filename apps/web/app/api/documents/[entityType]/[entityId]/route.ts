/**
 * Document Versions API
 * GET /api/documents/[entityType]/[entityId] - Get document version history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import {
  documentVersioning,
  AllDocumentType,
  DocumentEntityType,
} from '@/lib/services/document-versioning';

interface RouteParams {
  params: Promise<{ entityType: string; entityId: string }>;
}

// Valid document types for validation
const VALID_DOCUMENT_TYPES: AllDocumentType[] = [
  'vtv', 'insurance', 'cedula_verde', 'titulo', 'registration',
  'afip_certificate', 'afip_key', 'constancia_cuit', 'habilitacion',
  'dni', 'cuil_constancia', 'carnet', 'titulo_profesional',
];

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
    const documentTypeParam = searchParams.get('documentType');

    // Validate entity type
    if (!['vehicle', 'organization', 'user'].includes(entityType)) {
      return NextResponse.json(
        { success: false, error: 'Tipo de entidad invalido' },
        { status: 400 }
      );
    }

    const validEntityType = entityType as DocumentEntityType;

    // If documentType is provided, validate and get specific document history
    if (documentTypeParam) {
      if (!VALID_DOCUMENT_TYPES.includes(documentTypeParam as AllDocumentType)) {
        return NextResponse.json(
          { success: false, error: 'Tipo de documento invalido' },
          { status: 400 }
        );
      }

      const documentType = documentTypeParam as AllDocumentType;

      // Get version history for specific document type
      const versions = await documentVersioning.getVersionHistory(
        validEntityType,
        entityId,
        documentType
      );

      // Get current version
      const current = await documentVersioning.getCurrentVersion(
        validEntityType,
        entityId,
        documentType
      );

      return NextResponse.json({
        success: true,
        data: {
          current,
          versions,
          totalVersions: versions.length,
        },
      });
    }

    // No documentType - get all current documents for entity
    const allDocuments = await documentVersioning.getAllCurrentDocuments(
      validEntityType,
      entityId
    );

    return NextResponse.json({
      success: true,
      data: {
        documents: allDocuments,
        totalDocuments: allDocuments.length,
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
