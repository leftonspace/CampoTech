'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Shield,
  Download,
  Trash2,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Info,
  Mail,
  MapPin,
  Sparkles,
  Activity,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface PrivacyPreference {
  title: string;
  description: string;
  warning?: string;
}

interface PrivacyPreferences {
  marketingEmails: boolean;
  activityTracking: boolean;
  aiTraining: boolean;
  locationHistory: boolean;
}

interface PrivacyResponse {
  preferences: PrivacyPreferences;
  isDefault: boolean;
  lastUpdated?: string;
  descriptions: Record<keyof PrivacyPreferences, PrivacyPreference>;
}

interface ExportResponse {
  hasExport: boolean;
  export?: {
    id: string;
    status: 'pending' | 'processing' | 'completed' | 'failed' | 'expired';
    requestedAt: string;
    completedAt?: string;
    downloadUrl?: string;
    expiresAt?: string;
    errorMessage?: string;
  };
  message?: string;
}

interface DeletionResponse {
  hasPendingDeletion: boolean;
  request?: {
    id: string;
    status: 'pending' | 'confirmed' | 'processing' | 'completed';
    requestedAt: string;
    confirmedAt?: string;
    scheduledDeletionAt?: string;
    daysRemaining?: number;
    canCancel?: boolean;
  };
  preview?: {
    dataToDelete: string[];
    dataToRetain: string[];
    retentionPeriod: string;
    legalReason: string;
  };
  message?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchPrivacy(): Promise<PrivacyResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/privacy', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function updatePrivacy(data: Partial<PrivacyPreferences>): Promise<{ success: boolean; message?: string }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/privacy', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(data),
  });
  return res.json();
}

async function fetchExportStatus(): Promise<ExportResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/export', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function requestExport(): Promise<{ success: boolean; message?: string; export?: { downloadUrl?: string } }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/export', {
    method: 'POST',
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function fetchDeletionStatus(): Promise<DeletionResponse> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/delete-request', {
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function requestDeletion(): Promise<{ success: boolean; message?: string }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/delete-request', {
    method: 'POST',
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

async function cancelDeletion(): Promise<{ success: boolean; message?: string }> {
  const token = localStorage.getItem('accessToken');
  const res = await fetch('/api/users/me/delete-request', {
    method: 'DELETE',
    headers: { Authorization: token ? `Bearer ${token}` : '' },
  });
  return res.json();
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={() => !disabled && onChange(!checked)}
      disabled={disabled}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
        checked ? 'bg-primary-600' : 'bg-gray-200'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
    >
      <span
        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
          checked ? 'translate-x-6' : 'translate-x-1'
        }`}
      />
    </button>
  );
}

function PreferenceRow({
  icon: Icon,
  title,
  description,
  warning,
  checked,
  onChange,
  loading,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  warning?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  loading?: boolean;
}) {
  return (
    <div className="flex items-start gap-4 py-4 border-b border-gray-100 last:border-0">
      <div className="flex-shrink-0 p-2 rounded-lg bg-gray-100">
        <Icon className="h-5 w-5 text-gray-600" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="font-medium text-gray-900">{title}</h3>
        </div>
        <p className="text-sm text-gray-500 mt-1">{description}</p>
        {warning && (
          <p className="text-xs text-amber-600 mt-2 flex items-start gap-1">
            <Info className="h-3 w-3 flex-shrink-0 mt-0.5" />
            {warning}
          </p>
        )}
      </div>
      <Toggle checked={checked} onChange={onChange} disabled={loading} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function PrivacySettingsPage() {
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  // Queries
  const { data: privacyData, isLoading: privacyLoading } = useQuery({
    queryKey: ['privacy'],
    queryFn: fetchPrivacy,
  });

  const { data: exportData, isLoading: exportLoading } = useQuery({
    queryKey: ['export-status'],
    queryFn: fetchExportStatus,
  });

  const { data: deletionData, isLoading: deletionLoading } = useQuery({
    queryKey: ['deletion-status'],
    queryFn: fetchDeletionStatus,
  });

  // Mutations
  const updatePrivacyMutation = useMutation({
    mutationFn: updatePrivacy,
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Preferencias actualizadas');
        queryClient.invalidateQueries({ queryKey: ['privacy'] });
        setTimeout(() => setSuccess(''), 3000);
      }
    },
  });

  const exportMutation = useMutation({
    mutationFn: requestExport,
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Exportación completada');
        queryClient.invalidateQueries({ queryKey: ['export-status'] });
        if (response.export?.downloadUrl) {
          window.open(response.export.downloadUrl, '_blank');
        }
      } else {
        setError(response.message || 'Error al exportar');
      }
    },
  });

  const deletionMutation = useMutation({
    mutationFn: requestDeletion,
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Solicitud de eliminación creada. Revisa tu email.');
        queryClient.invalidateQueries({ queryKey: ['deletion-status'] });
        setShowDeleteConfirm(false);
      } else {
        setError(response.message || 'Error al solicitar eliminación');
      }
    },
  });

  const cancelDeletionMutation = useMutation({
    mutationFn: cancelDeletion,
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Solicitud de eliminación cancelada');
        queryClient.invalidateQueries({ queryKey: ['deletion-status'] });
      }
    },
  });

  const handlePreferenceChange = (key: keyof PrivacyPreferences, value: boolean) => {
    updatePrivacyMutation.mutate({ [key]: value });
  };

  const preferences = privacyData?.preferences;
  const descriptions = privacyData?.descriptions;

  if (privacyLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Privacidad y Datos</h1>
          <p className="text-gray-500">Gestioná tus datos personales (Ley 25.326)</p>
        </div>
      </div>

      {/* Messages */}
      {success && (
        <div className="rounded-md bg-success-50 p-4 text-success-700 flex items-center gap-2">
          <CheckCircle className="h-5 w-5" />
          {success}
        </div>
      )}
      {error && (
        <div className="rounded-md bg-danger-50 p-4 text-danger-700 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5" />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Privacy Preferences */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Shield className="h-5 w-5 text-gray-400" />
          <h2 className="font-medium text-gray-900">Preferencias de privacidad</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Controla como usamos tus datos. Podes cambiar estas preferencias en cualquier momento.
        </p>

        {preferences && descriptions && (
          <div className="divide-y divide-gray-100">
            <PreferenceRow
              icon={Mail}
              title={descriptions.marketingEmails.title}
              description={descriptions.marketingEmails.description}
              checked={preferences.marketingEmails}
              onChange={(v) => handlePreferenceChange('marketingEmails', v)}
              loading={updatePrivacyMutation.isPending}
            />
            <PreferenceRow
              icon={Activity}
              title={descriptions.activityTracking.title}
              description={descriptions.activityTracking.description}
              checked={preferences.activityTracking}
              onChange={(v) => handlePreferenceChange('activityTracking', v)}
              loading={updatePrivacyMutation.isPending}
            />
            <PreferenceRow
              icon={Sparkles}
              title={descriptions.aiTraining.title}
              description={descriptions.aiTraining.description}
              warning={descriptions.aiTraining.warning}
              checked={preferences.aiTraining}
              onChange={(v) => handlePreferenceChange('aiTraining', v)}
              loading={updatePrivacyMutation.isPending}
            />
            <PreferenceRow
              icon={MapPin}
              title={descriptions.locationHistory.title}
              description={descriptions.locationHistory.description}
              checked={preferences.locationHistory}
              onChange={(v) => handlePreferenceChange('locationHistory', v)}
              loading={updatePrivacyMutation.isPending}
            />
          </div>
        )}
      </div>

      {/* Data Export */}
      <div className="card p-6">
        <div className="flex items-center gap-2 mb-4">
          <Download className="h-5 w-5 text-gray-400" />
          <h2 className="font-medium text-gray-900">Exportar mis datos</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Descarga una copia de todos tus datos personales en formato JSON/CSV.
          <br />
          <span className="text-xs">(Derecho de Acceso - Art. 14 Ley 25.326)</span>
        </p>

        {exportData?.hasExport && exportData.export && (
          <div className="mb-4 p-3 rounded-lg bg-gray-50">
            <div className="flex items-center gap-2 text-sm">
              {exportData.export.status === 'completed' && (
                <>
                  <CheckCircle className="h-4 w-4 text-success-500" />
                  <span className="text-success-700">Exportación disponible</span>
                  {exportData.export.downloadUrl && (
                    <a
                      href={exportData.export.downloadUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-auto text-primary-600 hover:underline"
                    >
                      Descargar
                    </a>
                  )}
                </>
              )}
              {exportData.export.status === 'processing' && (
                <>
                  <Clock className="h-4 w-4 text-amber-500 animate-spin" />
                  <span className="text-amber-700">Procesando...</span>
                </>
              )}
              {exportData.export.status === 'expired' && (
                <>
                  <AlertTriangle className="h-4 w-4 text-gray-400" />
                  <span className="text-gray-500">Exportación expirada</span>
                </>
              )}
            </div>
            {exportData.export.expiresAt && exportData.export.status === 'completed' && (
              <p className="text-xs text-gray-500 mt-1">
                Disponible hasta: {new Date(exportData.export.expiresAt).toLocaleDateString('es-AR')}
              </p>
            )}
          </div>
        )}

        <button
          onClick={() => exportMutation.mutate()}
          disabled={exportMutation.isPending || exportData?.export?.status === 'processing'}
          className="btn-outline w-full"
        >
          <Download className="mr-2 h-4 w-4" />
          {exportMutation.isPending ? 'Generando...' : 'Solicitar exportación'}
        </button>
      </div>

      {/* Account Deletion */}
      <div className="card p-6 border-danger-200">
        <div className="flex items-center gap-2 mb-4">
          <Trash2 className="h-5 w-5 text-danger-500" />
          <h2 className="font-medium text-danger-700">Eliminar mi cuenta</h2>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Solicita la eliminación de tu cuenta y datos personales.
          <br />
          <span className="text-xs">(Derecho de Supresión - Art. 16 Ley 25.326)</span>
        </p>

        {deletionData?.hasPendingDeletion && deletionData.request && (
          <div className="mb-4 p-4 rounded-lg bg-danger-50 border border-danger-200">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-danger-500" />
              <span className="font-medium text-danger-700">
                {deletionData.request.status === 'pending'
                  ? 'Solicitud pendiente de confirmación'
                  : 'Cuenta programada para eliminación'}
              </span>
            </div>
            {deletionData.request.daysRemaining !== undefined && (
              <p className="text-sm text-danger-600 mt-2">
                Tu cuenta será eliminada en {deletionData.request.daysRemaining} días.
              </p>
            )}
            {deletionData.request.canCancel && (
              <button
                onClick={() => cancelDeletionMutation.mutate()}
                disabled={cancelDeletionMutation.isPending}
                className="mt-3 text-sm text-primary-600 hover:underline"
              >
                Cancelar solicitud
              </button>
            )}

            {deletionData.preview && (
              <div className="mt-4 pt-4 border-t border-danger-200">
                <p className="text-xs font-medium text-gray-700 mb-2">Se eliminará:</p>
                <ul className="text-xs text-gray-600 list-disc list-inside mb-3">
                  {deletionData.preview.dataToDelete.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="text-xs font-medium text-gray-700 mb-2">Se conservará (requerimiento legal):</p>
                <ul className="text-xs text-gray-600 list-disc list-inside">
                  {deletionData.preview.dataToRetain.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
                <p className="text-xs text-gray-500 mt-2 italic">
                  {deletionData.preview.legalReason}
                </p>
              </div>
            )}
          </div>
        )}

        {!deletionData?.hasPendingDeletion && (
          <>
            {showDeleteConfirm ? (
              <div className="p-4 rounded-lg bg-danger-50 border border-danger-200">
                <p className="text-sm text-danger-700 mb-4">
                  Esta acción es irreversible. Tu cuenta será eliminada permanentemente despues de 30 días.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowDeleteConfirm(false)}
                    className="btn-outline flex-1"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => deletionMutation.mutate()}
                    disabled={deletionMutation.isPending}
                    className="flex-1 px-4 py-2 bg-danger-600 text-white rounded-md hover:bg-danger-700 disabled:opacity-50"
                  >
                    {deletionMutation.isPending ? 'Procesando...' : 'Confirmar eliminación'}
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-full px-4 py-2 border border-danger-300 text-danger-600 rounded-md hover:bg-danger-50"
              >
                <Trash2 className="mr-2 h-4 w-4 inline" />
                Solicitar eliminación de cuenta
              </button>
            )}
          </>
        )}
      </div>

      {/* Legal Info */}
      <div className="text-center text-sm text-gray-500 py-4">
        <p>
          Tus derechos están protegidos por la{' '}
          <a
            href="https://www.argentina.gob.ar/normativa/nacional/ley-25326-64790"
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary-600 hover:underline"
          >
            Ley 25.326 de Protección de Datos Personales
          </a>
        </p>
        <p className="mt-1">
          Contacto DPO:{' '}
          <a href="mailto:privacidad@campotech.com" className="text-primary-600 hover:underline">
            privacidad@campotech.com
          </a>
        </p>
      </div>
    </div>
  );
}
