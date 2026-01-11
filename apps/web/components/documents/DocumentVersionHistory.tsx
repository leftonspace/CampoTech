'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  FileText,
  Download,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  History,
  Eye,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface DocumentVersion {
  id: string;
  entityType: string;
  entityId: string;
  documentType: string;
  fileUrl: string;
  fileSizeBytes: number | null;
  originalFilename: string | null;
  mimeType: string | null;
  uploadedBy: string | null;
  uploadedAt: string;
  validFrom: string | null;
  expiresAt: string | null;
  isCurrent: boolean;
  versionNumber: number;
  metadata: Record<string, unknown>;
}

interface DocumentVersionHistoryProps {
  entityType: 'vehicle' | 'organization' | 'user';
  entityId: string;
  documentType?: string;
  title?: string;
  showUpload?: boolean;
  onUpload?: () => void;
}

interface VersionsResponse {
  success: boolean;
  data: {
    current: DocumentVersion | null;
    versions: DocumentVersion[];
    totalVersions: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  vtv: 'VTV',
  insurance: 'Seguro',
  cedula_verde: 'Cedula Verde',
  titulo: 'Titulo',
  registration: 'Registro',
  afip_certificate: 'Certificado AFIP',
  afip_key: 'Clave AFIP',
  constancia_cuit: 'Constancia CUIT',
  habilitacion: 'Habilitacion',
  dni: 'DNI',
  cuil_constancia: 'Constancia CUIL',
  carnet: 'Carnet',
  titulo_profesional: 'Titulo Profesional',
};

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchVersions(
  entityType: string,
  entityId: string,
  documentType?: string
): Promise<VersionsResponse> {
  const token = localStorage.getItem('accessToken');
  const params = documentType ? `?documentType=${documentType}` : '';
  const res = await fetch(`/api/documents/${entityType}/${entityId}${params}`, {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number | null): string {
  if (!bytes) return '-';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getExpiryStatus(expiresAt: string | null): {
  status: 'valid' | 'expiring_soon' | 'expired' | 'no_expiry';
  label: string;
  color: string;
} {
  if (!expiresAt) {
    return { status: 'no_expiry', label: 'Sin vencimiento', color: 'text-gray-500' };
  }

  const expiry = new Date(expiresAt);
  const now = new Date();
  const thirtyDays = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  if (expiry < now) {
    return { status: 'expired', label: 'Vencido', color: 'text-danger-600 bg-danger-50' };
  }
  if (expiry < thirtyDays) {
    return { status: 'expiring_soon', label: 'Por vencer', color: 'text-amber-600 bg-amber-50' };
  }
  return { status: 'valid', label: 'Vigente', color: 'text-success-600 bg-success-50' };
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function VersionRow({
  version,
  isExpanded,
  onToggle,
}: {
  version: DocumentVersion;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const expiryInfo = getExpiryStatus(version.expiresAt);

  return (
    <div className={`border-b border-gray-100 last:border-0 ${version.isCurrent ? 'bg-primary-50' : ''}`}>
      <div
        className="p-3 flex items-center gap-3 cursor-pointer hover:bg-gray-50"
        onClick={onToggle}
      >
        <div className="flex-shrink-0">
          <FileText className={`h-5 w-5 ${version.isCurrent ? 'text-primary-600' : 'text-gray-400'}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900">
              Version {version.versionNumber}
            </span>
            {version.isCurrent && (
              <span className="px-2 py-0.5 text-xs font-medium bg-primary-100 text-primary-700 rounded-full">
                Actual
              </span>
            )}
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${expiryInfo.color}`}>
              {expiryInfo.label}
            </span>
          </div>
          <p className="text-xs text-gray-500 truncate">
            {version.originalFilename || 'documento'}
          </p>
        </div>
        <div className="text-right text-xs text-gray-500">
          {formatDate(version.uploadedAt)}
        </div>
        <div className="flex-shrink-0">
          {isExpanded ? (
            <ChevronUp className="h-4 w-4 text-gray-400" />
          ) : (
            <ChevronDown className="h-4 w-4 text-gray-400" />
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pl-11 space-y-3">
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div>
              <span className="text-gray-500">Subido por:</span>
              <span className="ml-1 text-gray-900">{version.uploadedBy || 'Sistema'}</span>
            </div>
            <div>
              <span className="text-gray-500">Tamaño:</span>
              <span className="ml-1 text-gray-900">{formatFileSize(version.fileSizeBytes)}</span>
            </div>
            <div>
              <span className="text-gray-500">Valido desde:</span>
              <span className="ml-1 text-gray-900">{formatDate(version.validFrom)}</span>
            </div>
            <div>
              <span className="text-gray-500">Vence:</span>
              <span className="ml-1 text-gray-900">{formatDate(version.expiresAt)}</span>
            </div>
          </div>

          <div className="flex gap-2">
            <a
              href={version.fileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-md hover:bg-primary-100"
            >
              <Eye className="h-3 w-3" />
              Ver
            </a>
            <a
              href={version.fileUrl}
              download={version.originalFilename || 'documento'}
              className="flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200"
            >
              <Download className="h-3 w-3" />
              Descargar
            </a>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function DocumentVersionHistory({
  entityType,
  entityId,
  documentType,
  title = 'Historial de versiones',
  showUpload = false,
  onUpload,
}: DocumentVersionHistoryProps) {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);
  const [showAllVersions, setShowAllVersions] = useState(false);

  const { data, isLoading, error } = useQuery({
    queryKey: ['document-versions', entityType, entityId, documentType],
    queryFn: () => fetchVersions(entityType, entityId, documentType),
    enabled: !!entityId,
  });

  const versions = data?.data?.versions || [];
  const current = data?.data?.current;
  const totalVersions = data?.data?.totalVersions || 0;

  const displayVersions = showAllVersions ? versions : versions.slice(0, 5);

  if (isLoading) {
    return (
      <div className="p-4 text-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary-500 border-t-transparent mx-auto" />
      </div>
    );
  }

  if (error || !data?.success) {
    return (
      <div className="p-4 text-center text-gray-500 text-sm">
        Error cargando historial
      </div>
    );
  }

  if (versions.length === 0) {
    return (
      <div className="p-6 text-center">
        <History className="h-8 w-8 text-gray-300 mx-auto mb-2" />
        <p className="text-gray-500 text-sm">No hay documentos</p>
        {showUpload && onUpload && (
          <button onClick={onUpload} className="mt-3 btn-outline text-sm">
            Subir documento
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-gray-500" />
          <h3 className="font-medium text-gray-900 text-sm">
            {documentType ? DOCUMENT_TYPE_LABELS[documentType] || documentType : title}
          </h3>
          <span className="text-xs text-gray-500">
            ({totalVersions} {totalVersions === 1 ? 'version' : 'versiones'})
          </span>
        </div>
        {showUpload && onUpload && (
          <button onClick={onUpload} className="text-xs text-primary-600 hover:underline">
            + Nueva version
          </button>
        )}
      </div>

      {/* Current Document Summary */}
      {current && (
        <div className="px-4 py-3 bg-primary-50 border-b border-primary-100">
          <div className="flex items-center gap-3">
            <CheckCircle className="h-5 w-5 text-primary-600" />
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Documento actual</p>
              <p className="text-xs text-gray-500">
                {current.originalFilename} - {formatDate(current.uploadedAt)}
              </p>
            </div>
            {current.expiresAt && (
              <div className={`text-xs ${getExpiryStatus(current.expiresAt).color} px-2 py-1 rounded-full`}>
                Vence: {formatDate(current.expiresAt)}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Version List */}
      <div className="divide-y divide-gray-100">
        {displayVersions.map((version) => (
          <VersionRow
            key={version.id}
            version={version}
            isExpanded={expandedVersion === version.id}
            onToggle={() =>
              setExpandedVersion(expandedVersion === version.id ? null : version.id)
            }
          />
        ))}
      </div>

      {/* Show More */}
      {totalVersions > 5 && !showAllVersions && (
        <button
          onClick={() => setShowAllVersions(true)}
          className="w-full px-4 py-2 text-xs text-primary-600 hover:bg-gray-50 border-t border-gray-100"
        >
          Ver todas las versiones ({totalVersions - 5} mas)
        </button>
      )}
    </div>
  );
}

// Export convenience components for specific document types
export function VehicleDocumentHistory({
  vehicleId,
  documentType,
}: {
  vehicleId: string;
  documentType?: string;
}) {
  return (
    <DocumentVersionHistory
      entityType="vehicle"
      entityId={vehicleId}
      documentType={documentType}
    />
  );
}

export function OrganizationDocumentHistory({
  organizationId,
  documentType,
}: {
  organizationId: string;
  documentType?: string;
}) {
  return (
    <DocumentVersionHistory
      entityType="organization"
      entityId={organizationId}
      documentType={documentType}
    />
  );
}

export function UserDocumentHistory({
  userId,
  documentType,
}: {
  userId: string;
  documentType?: string;
}) {
  return (
    <DocumentVersionHistory
      entityType="user"
      entityId={userId}
      documentType={documentType}
    />
  );
}
