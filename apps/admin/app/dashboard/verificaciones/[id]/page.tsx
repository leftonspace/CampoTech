'use client';

/**
 * Admin Verification Review Page
 * ================================
 *
 * Document viewer and review form for verification submissions.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  VerificationSubmissionDetail,
  VerificationCategory,
  VerificationAppliesTo,
  VerificationSubmissionStatus,
  REJECTION_REASONS,
} from '@/types';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_LABELS: Record<VerificationCategory, string> = {
  identity: 'Identidad',
  business: 'Negocio',
  professional: 'Profesional',
  insurance: 'Seguros',
  background: 'Antecedentes',
  financial: 'Financiero',
};

const APPLIES_TO_LABELS: Record<VerificationAppliesTo, string> = {
  organization: 'Organización',
  owner: 'Dueño',
  employee: 'Empleado',
};

const STATUS_LABELS: Record<VerificationSubmissionStatus, string> = {
  pending: 'Pendiente',
  in_review: 'En revisión',
  approved: 'Aprobado',
  rejected: 'Rechazado',
  expired: 'Vencido',
};

const STATUS_COLORS: Record<VerificationSubmissionStatus, string> = {
  pending: 'bg-yellow-100 text-yellow-700',
  in_review: 'bg-blue-100 text-blue-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-slate-100 text-slate-700',
};

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function VerificationReviewPage() {
  const params = useParams();
  const router = useRouter();
  const submissionId = params.id as string;

  // State
  const [submission, setSubmission] = useState<VerificationSubmissionDetail | null>(null);
  const [requirement, setRequirement] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Document viewer state
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);

  // Review form state
  const [expiresAt, setExpiresAt] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // Rejection modal
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionCode, setRejectionCode] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  // Correction modal
  const [showCorrectionModal, setShowCorrectionModal] = useState(false);
  const [correctionNote, setCorrectionNote] = useState('');

  // Fetch data
  useEffect(() => {
    fetchSubmission();
  }, [submissionId]);

  async function fetchSubmission() {
    try {
      setLoading(true);
      const response = await fetch(`/api/admin/verifications/${submissionId}`);
      const data = await response.json();

      if (data.success) {
        setSubmission(data.data.submission);
        setRequirement(data.data.requirement);
        setAdminNotes(data.data.submission.adminNotes || '');

        // Start review if pending
        if (data.data.submission.status === 'pending') {
          startReview();
        }
      } else {
        setError(data.error || 'Error fetching submission');
      }
    } catch (err) {
      setError('Error connecting to server');
    } finally {
      setLoading(false);
    }
  }

  async function startReview() {
    try {
      await fetch(`/api/admin/verifications/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start-review' }),
      });
    } catch (err) {
      console.error('Error starting review:', err);
    }
  }

  async function performAction(action: string, data: Record<string, unknown> = {}) {
    try {
      setActionLoading(true);
      setActionMessage(null);

      const response = await fetch(`/api/admin/verifications/${submissionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...data }),
      });

      const result = await response.json();

      if (result.success) {
        setActionMessage({ type: 'success', text: result.message });
        // Redirect back to queue after a short delay
        setTimeout(() => {
          router.push('/dashboard/verificaciones');
        }, 1500);
      } else {
        setActionMessage({ type: 'error', text: result.error || 'Error performing action' });
      }
    } catch (err) {
      setActionMessage({ type: 'error', text: 'Error connecting to server' });
    } finally {
      setActionLoading(false);
    }
  }

  function handleApprove() {
    if (requirement?.requiresExpiration && !expiresAt) {
      setActionMessage({ type: 'error', text: 'Debe ingresar una fecha de vencimiento' });
      return;
    }

    performAction('approve', {
      expiresAt: expiresAt || undefined,
      adminNotes,
    });
  }

  function handleReject() {
    if (!rejectionCode || !rejectionReason) {
      setActionMessage({ type: 'error', text: 'Debe seleccionar un motivo y proporcionar detalles' });
      return;
    }

    performAction('reject', {
      rejectionCode,
      rejectionReason,
      adminNotes,
    });
    setShowRejectionModal(false);
  }

  function handleRequestCorrection() {
    if (!correctionNote) {
      setActionMessage({ type: 'error', text: 'Debe proporcionar instrucciones para la corrección' });
      return;
    }

    performAction('request-correction', {
      correctionNote,
      adminNotes,
    });
    setShowCorrectionModal(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Cargando verificación...</p>
        </div>
      </div>
    );
  }

  if (error || !submission) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <p className="text-red-700">{error || 'Submission not found'}</p>
        <Link
          href="/dashboard/verificaciones"
          className="text-blue-600 hover:underline mt-4 inline-block"
        >
          ← Volver a verificaciones
        </Link>
      </div>
    );
  }

  const isImage = submission.documentType?.startsWith('image/');
  const isPdf = submission.documentType === 'application/pdf';

  return (
    <div>
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <Link
          href="/dashboard/verificaciones"
          className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-slate-900">Revisar Verificación</h1>
          <p className="text-slate-500">
            {submission.requirementName} - {submission.organizationName}
          </p>
        </div>
        <span className={`px-3 py-1.5 text-sm font-medium rounded-full ${STATUS_COLORS[submission.status]}`}>
          {STATUS_LABELS[submission.status]}
        </span>
      </div>

      {/* Action Message */}
      {actionMessage && (
        <div
          className={`mb-6 p-4 rounded-xl border ${
            actionMessage.type === 'success'
              ? 'bg-green-50 border-green-200 text-green-700'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {actionMessage.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Document Viewer */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50">
            <h2 className="font-semibold text-slate-900">Documento</h2>
            <div className="flex items-center gap-2">
              {isImage && (
                <>
                  <button
                    onClick={() => setZoom((z) => Math.max(50, z - 25))}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    title="Reducir"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                  </button>
                  <span className="text-sm text-slate-600 min-w-[50px] text-center">{zoom}%</span>
                  <button
                    onClick={() => setZoom((z) => Math.min(200, z + 25))}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    title="Ampliar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setRotation((r) => (r + 90) % 360)}
                    className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                    title="Rotar"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                </>
              )}
              {submission.documentUrl && (
                <a
                  href={submission.documentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-lg"
                  title="Descargar"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                </a>
              )}
            </div>
          </div>

          <div className="p-4 min-h-[400px] flex items-center justify-center bg-slate-100 overflow-auto">
            {submission.documentUrl ? (
              isImage ? (
                <img
                  src={submission.documentUrl}
                  alt="Documento"
                  style={{
                    transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                    transition: 'transform 0.2s ease',
                    maxWidth: '100%',
                  }}
                  className="rounded-lg shadow-lg"
                />
              ) : isPdf ? (
                <iframe
                  src={submission.documentUrl}
                  className="w-full h-[500px] rounded-lg"
                  title="PDF Viewer"
                />
              ) : (
                <div className="text-center">
                  <svg
                    className="w-16 h-16 text-slate-300 mx-auto mb-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  <p className="text-slate-500 mb-2">{submission.documentFilename}</p>
                  <a
                    href={submission.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    Descargar documento
                  </a>
                </div>
              )
            ) : submission.submittedValue ? (
              <div className="text-center">
                <p className="text-slate-500 mb-2">Valor enviado:</p>
                <code className="text-2xl bg-white px-4 py-2 rounded-lg border border-slate-200">
                  {submission.submittedValue}
                </code>
              </div>
            ) : (
              <p className="text-slate-400">Sin documento</p>
            )}
          </div>
        </div>

        {/* Right: Review Form */}
        <div className="space-y-6">
          {/* Submission Info */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-slate-900 mb-4">Información</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-slate-500">Organización</p>
                <p className="font-medium text-slate-900">{submission.organizationName}</p>
              </div>
              {submission.userName && (
                <div>
                  <p className="text-slate-500">Persona</p>
                  <p className="font-medium text-slate-900">{submission.userName}</p>
                </div>
              )}
              <div>
                <p className="text-slate-500">Requisito</p>
                <p className="font-medium text-slate-900">{submission.requirementName}</p>
              </div>
              <div>
                <p className="text-slate-500">Categoría</p>
                <p className="font-medium text-slate-900">
                  {CATEGORY_LABELS[submission.category]} / {APPLIES_TO_LABELS[submission.appliesTo]}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Enviado</p>
                <p className="font-medium text-slate-900">{formatDateTime(submission.submittedAt)}</p>
              </div>
              <div>
                <p className="text-slate-500">Tier</p>
                <p className="font-medium text-slate-900">{submission.tier}</p>
              </div>
            </div>

            {/* Auto-verify result */}
            {submission.autoVerifyResponse && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-100">
                <p className="text-sm font-medium text-blue-900 mb-1">Verificación automática:</p>
                <pre className="text-xs text-blue-700 overflow-x-auto">
                  {JSON.stringify(submission.autoVerifyResponse, null, 2)}
                </pre>
              </div>
            )}
          </div>

          {/* Previous Submissions */}
          {submission.previousSubmissions.length > 0 && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
              <h2 className="font-semibold text-slate-900 mb-4">Envíos anteriores</h2>
              <div className="space-y-3">
                {submission.previousSubmissions.map((prev) => (
                  <div
                    key={prev.id}
                    className="p-3 bg-slate-50 rounded-lg border border-slate-100"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-600">
                        {formatDateTime(prev.submittedAt)}
                      </span>
                      <span
                        className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                          STATUS_COLORS[prev.status]
                        }`}
                      >
                        {STATUS_LABELS[prev.status]}
                      </span>
                    </div>
                    {prev.rejectionReason && (
                      <p className="text-xs text-red-600 mt-1">{prev.rejectionReason}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Review Form */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
            <h2 className="font-semibold text-slate-900 mb-4">Revisión</h2>

            {/* Expiration Date */}
            {requirement?.requiresExpiration && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Fecha de vencimiento *
                </label>
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(e) => setExpiresAt(e.target.value)}
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                />
              </div>
            )}

            {/* Admin Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Notas internas
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Notas para uso interno..."
              />
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 bg-green-600 text-white rounded-lg font-medium hover:bg-green-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                Aprobar
              </button>

              <button
                onClick={() => setShowCorrectionModal(true)}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Corregir
              </button>

              <button
                onClick={() => setShowRejectionModal(true)}
                disabled={actionLoading}
                className="flex-1 py-3 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Rechazar
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Rejection Modal */}
      {showRejectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Rechazar Verificación</h3>

            <div className="mb-4">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Motivo del rechazo *
              </label>
              <select
                value={rejectionCode}
                onChange={(e) => {
                  setRejectionCode(e.target.value);
                  const reason = REJECTION_REASONS.find((r) => r.code === e.target.value);
                  if (reason && reason.code !== 'other') {
                    setRejectionReason(reason.label);
                  }
                }}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              >
                <option value="">Seleccionar motivo...</option>
                {REJECTION_REASONS.map((reason) => (
                  <option key={reason.code} value={reason.code}>
                    {reason.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Detalles adicionales *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                rows={3}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Proporcione detalles del rechazo..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowRejectionModal(false)}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleReject}
                disabled={!rejectionCode || !rejectionReason || actionLoading}
                className="flex-1 py-2 px-4 bg-red-600 text-white rounded-lg font-medium hover:bg-red-700 disabled:opacity-50"
              >
                Confirmar Rechazo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Correction Modal */}
      {showCorrectionModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Solicitar Corrección</h3>

            <div className="mb-6">
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Instrucciones para el usuario *
              </label>
              <textarea
                value={correctionNote}
                onChange={(e) => setCorrectionNote(e.target.value)}
                rows={4}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-none"
                placeholder="Explique qué debe corregir el usuario..."
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowCorrectionModal(false)}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 rounded-lg font-medium hover:bg-slate-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleRequestCorrection}
                disabled={!correctionNote || actionLoading}
                className="flex-1 py-2 px-4 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-600 disabled:opacity-50"
              >
                Enviar Solicitud
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
