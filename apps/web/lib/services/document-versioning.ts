/**
 * CampoTech Document Versioning Service
 * ======================================
 *
 * Handles version control for documents (VTV, Insurance, Cédula Verde, etc.)
 * Never deletes old versions for legal compliance.
 */

import { prisma } from '@/lib/prisma';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type DocumentEntityType = 'vehicle' | 'organization' | 'user';

export type VehicleDocumentType = 'vtv' | 'insurance' | 'cedula_verde' | 'titulo' | 'registration';

export type OrganizationDocumentType = 'afip_certificate' | 'afip_key' | 'constancia_cuit' | 'habilitacion';

export type UserDocumentType = 'dni' | 'cuil_constancia' | 'carnet' | 'titulo_profesional';

export type AllDocumentType = VehicleDocumentType | OrganizationDocumentType | UserDocumentType;

export interface DocumentVersion {
  id: string;
  entityType: DocumentEntityType;
  entityId: string;
  documentType: AllDocumentType;
  fileUrl: string;
  fileSizeBytes: number | null;
  originalFilename: string | null;
  mimeType: string | null;
  uploadedBy: string | null;
  uploadedAt: Date;
  validFrom: Date | null;
  expiresAt: Date | null;
  isCurrent: boolean;
  versionNumber: number;
  metadata: Record<string, unknown>;
}

export interface UploadDocumentInput {
  entityType: DocumentEntityType;
  entityId: string;
  documentType: AllDocumentType;
  fileUrl: string;
  fileSizeBytes?: number;
  originalFilename?: string;
  mimeType?: string;
  uploadedBy: string;
  validFrom?: Date;
  expiresAt?: Date;
  metadata?: Record<string, unknown>;
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT VERSIONING SERVICE
// ═══════════════════════════════════════════════════════════════════════════════

export class DocumentVersioningService {
  /**
   * Upload a new document version
   * Automatically sets previous version as not current
   */
  async uploadDocument(input: UploadDocumentInput): Promise<DocumentVersion> {
    try {
      // The trigger in the database handles:
      // 1. Setting previous versions as not current
      // 2. Calculating version number

      const result = await prisma.$queryRaw<Array<{
        id: string;
        entity_type: string;
        entity_id: string;
        document_type: string;
        file_url: string;
        file_size_bytes: number | null;
        original_filename: string | null;
        mime_type: string | null;
        uploaded_by: string | null;
        uploaded_at: Date;
        valid_from: Date | null;
        expires_at: Date | null;
        is_current: boolean;
        version_number: number;
        metadata: Record<string, unknown>;
      }>>`
        INSERT INTO document_versions (
          entity_type,
          entity_id,
          document_type,
          file_url,
          file_size_bytes,
          original_filename,
          mime_type,
          uploaded_by,
          valid_from,
          expires_at,
          metadata
        ) VALUES (
          ${input.entityType},
          ${input.entityId}::uuid,
          ${input.documentType},
          ${input.fileUrl},
          ${input.fileSizeBytes || null},
          ${input.originalFilename || null},
          ${input.mimeType || null},
          ${input.uploadedBy}::uuid,
          ${input.validFrom || null}::date,
          ${input.expiresAt || null}::date,
          ${JSON.stringify(input.metadata || {})}::jsonb
        )
        RETURNING
          id, entity_type, entity_id, document_type, file_url,
          file_size_bytes, original_filename, mime_type, uploaded_by,
          uploaded_at, valid_from, expires_at, is_current, version_number, metadata
      `;

      const doc = result[0];
      return this.mapToDocumentVersion(doc);
    } catch (error) {
      console.error('Error uploading document:', error);
      throw error;
    }
  }

  /**
   * Get current version of a document
   */
  async getCurrentVersion(
    entityType: DocumentEntityType,
    entityId: string,
    documentType: AllDocumentType
  ): Promise<DocumentVersion | null> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          id, entity_type, entity_id, document_type, file_url,
          file_size_bytes, original_filename, mime_type, uploaded_by,
          uploaded_at, valid_from, expires_at, is_current, version_number, metadata
        FROM document_versions
        WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}::uuid
        AND document_type = ${documentType}
        AND is_current = true
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      return this.mapToDocumentVersion(result[0]);
    } catch (error) {
      console.error('Error getting current document version:', error);
      return null;
    }
  }

  /**
   * Get all versions of a document (for history view)
   */
  async getVersionHistory(
    entityType: DocumentEntityType,
    entityId: string,
    documentType: AllDocumentType
  ): Promise<DocumentVersion[]> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          id, entity_type, entity_id, document_type, file_url,
          file_size_bytes, original_filename, mime_type, uploaded_by,
          uploaded_at, valid_from, expires_at, is_current, version_number, metadata
        FROM document_versions
        WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}::uuid
        AND document_type = ${documentType}
        ORDER BY version_number DESC
      `;

      return result.map((doc: typeof result[number]) => this.mapToDocumentVersion(doc));
    } catch (error) {
      console.error('Error getting document history:', error);
      return [];
    }
  }

  /**
   * Get all current documents for an entity
   */
  async getAllCurrentDocuments(
    entityType: DocumentEntityType,
    entityId: string
  ): Promise<DocumentVersion[]> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          id, entity_type, entity_id, document_type, file_url,
          file_size_bytes, original_filename, mime_type, uploaded_by,
          uploaded_at, valid_from, expires_at, is_current, version_number, metadata
        FROM document_versions
        WHERE entity_type = ${entityType}
        AND entity_id = ${entityId}::uuid
        AND is_current = true
        ORDER BY document_type
      `;

      return result.map((doc: typeof result[number]) => this.mapToDocumentVersion(doc));
    } catch (error) {
      console.error('Error getting all documents:', error);
      return [];
    }
  }

  /**
   * Get documents expiring soon
   */
  async getExpiringDocuments(
    orgId: string,
    withinDays: number = 30
  ): Promise<DocumentVersion[]> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() + withinDays);

      // For vehicles, we need to filter by organization
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          dv.id, dv.entity_type, dv.entity_id, dv.document_type, dv.file_url,
          dv.file_size_bytes, dv.original_filename, dv.mime_type, dv.uploaded_by,
          dv.uploaded_at, dv.valid_from, dv.expires_at, dv.is_current, dv.version_number, dv.metadata
        FROM document_versions dv
        LEFT JOIN vehicles v ON dv.entity_type = 'vehicle' AND dv.entity_id = v.id
        WHERE dv.is_current = true
        AND dv.expires_at IS NOT NULL
        AND dv.expires_at <= ${cutoffDate}::date
        AND dv.expires_at >= CURRENT_DATE
        AND (
          dv.entity_type = 'organization' AND dv.entity_id = ${orgId}::uuid
          OR dv.entity_type = 'vehicle' AND v.organization_id = ${orgId}
        )
        ORDER BY dv.expires_at ASC
      `;

      return result.map((doc: typeof result[number]) => this.mapToDocumentVersion(doc));
    } catch (error) {
      console.error('Error getting expiring documents:', error);
      return [];
    }
  }

  /**
   * Get expired documents
   */
  async getExpiredDocuments(orgId: string): Promise<DocumentVersion[]> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          dv.id, dv.entity_type, dv.entity_id, dv.document_type, dv.file_url,
          dv.file_size_bytes, dv.original_filename, dv.mime_type, dv.uploaded_by,
          dv.uploaded_at, dv.valid_from, dv.expires_at, dv.is_current, dv.version_number, dv.metadata
        FROM document_versions dv
        LEFT JOIN vehicles v ON dv.entity_type = 'vehicle' AND dv.entity_id = v.id
        WHERE dv.is_current = true
        AND dv.expires_at IS NOT NULL
        AND dv.expires_at < CURRENT_DATE
        AND (
          dv.entity_type = 'organization' AND dv.entity_id = ${orgId}::uuid
          OR dv.entity_type = 'vehicle' AND v.organization_id = ${orgId}
        )
        ORDER BY dv.expires_at DESC
      `;

      return result.map((doc: typeof result[number]) => this.mapToDocumentVersion(doc));
    } catch (error) {
      console.error('Error getting expired documents:', error);
      return [];
    }
  }

  /**
   * Get a specific version by ID
   */
  async getVersion(versionId: string): Promise<DocumentVersion | null> {
    try {
      const result = await prisma.$queryRaw<Array<Record<string, unknown>>>`
        SELECT
          id, entity_type, entity_id, document_type, file_url,
          file_size_bytes, original_filename, mime_type, uploaded_by,
          uploaded_at, valid_from, expires_at, is_current, version_number, metadata
        FROM document_versions
        WHERE id = ${versionId}::uuid
        LIMIT 1
      `;

      if (result.length === 0) {
        return null;
      }

      return this.mapToDocumentVersion(result[0]);
    } catch (error) {
      console.error('Error getting document version:', error);
      return null;
    }
  }

  /**
   * Map database row to DocumentVersion type
   */
  private mapToDocumentVersion(row: Record<string, unknown>): DocumentVersion {
    return {
      id: row.id as string,
      entityType: row.entity_type as DocumentEntityType,
      entityId: row.entity_id as string,
      documentType: row.document_type as AllDocumentType,
      fileUrl: row.file_url as string,
      fileSizeBytes: row.file_size_bytes as number | null,
      originalFilename: row.original_filename as string | null,
      mimeType: row.mime_type as string | null,
      uploadedBy: row.uploaded_by as string | null,
      uploadedAt: row.uploaded_at as Date,
      validFrom: row.valid_from as Date | null,
      expiresAt: row.expires_at as Date | null,
      isCurrent: row.is_current as boolean,
      versionNumber: row.version_number as number,
      metadata: (row.metadata as Record<string, unknown>) || {},
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// DOCUMENT TYPE LABELS
// ═══════════════════════════════════════════════════════════════════════════════

export const DOCUMENT_TYPE_LABELS: Record<AllDocumentType, string> = {
  // Vehicle
  vtv: 'VTV (Verificación Técnica Vehicular)',
  insurance: 'Seguro',
  cedula_verde: 'Cédula Verde',
  titulo: 'Título del Automotor',
  registration: 'Patente/Registro',

  // Organization
  afip_certificate: 'Certificado AFIP',
  afip_key: 'Clave Privada AFIP',
  constancia_cuit: 'Constancia de CUIT',
  habilitacion: 'Habilitación Municipal',

  // User
  dni: 'DNI',
  cuil_constancia: 'Constancia de CUIL',
  carnet: 'Carnet de Conducir',
  titulo_profesional: 'Título Profesional/Matrícula',
};

// ═══════════════════════════════════════════════════════════════════════════════
// SINGLETON INSTANCE
// ═══════════════════════════════════════════════════════════════════════════════

let documentVersioningInstance: DocumentVersioningService | null = null;

export function getDocumentVersioningService(): DocumentVersioningService {
  if (!documentVersioningInstance) {
    documentVersioningInstance = new DocumentVersioningService();
  }
  return documentVersioningInstance;
}

export const documentVersioning = getDocumentVersioningService();
