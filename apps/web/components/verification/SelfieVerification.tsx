'use client';

/**
 * Selfie Verification Flow Component
 * ===================================
 *
 * Multi-step identity verification flow:
 * 1. Upload DNI front photo
 * 2. Upload DNI back photo (optional)
 * 3. Capture live selfie holding DNI
 * 4. Submit for review
 *
 * All images are stored linked to the same verification submission.
 */

import { useState, useCallback, useMemo } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  CreditCard,
  Camera,
  Upload,
  Loader2,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentUpload } from './DocumentUpload';
import { SelfieCapture } from './SelfieCapture';
import { DocumentViewer } from './DocumentViewer';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface SelfieVerificationProps {
  /** User ID for the verification */
  userId?: string;
  /** Callback when verification is completed */
  onComplete?: (result: VerificationResult) => void;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Whether to require DNI back photo */
  requireDniBack?: boolean;
  /** Additional class names */
  className?: string;
}

export interface VerificationResult {
  success: boolean;
  submissionId?: string;
  paths?: {
    dniFront?: string;
    dniBack?: string;
    selfie?: string;
  };
  error?: string;
}

interface StepData {
  dniFront: { blob: Blob | null; path: string | null };
  dniBack: { blob: Blob | null; path: string | null };
  selfie: { blob: Blob | null; path: string | null };
}

type Step = 'dni_front' | 'dni_back' | 'selfie' | 'review' | 'submitting' | 'complete';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STEP_CONFIG = {
  dni_front: {
    title: 'Foto del DNI (Frente)',
    description: 'Subí una foto clara del frente de tu DNI',
    icon: CreditCard,
  },
  dni_back: {
    title: 'Foto del DNI (Dorso)',
    description: 'Subí una foto clara del dorso de tu DNI',
    icon: CreditCard,
  },
  selfie: {
    title: 'Selfie con DNI',
    description: 'Tomate una selfie sosteniendo tu DNI junto a tu rostro',
    icon: Camera,
  },
  review: {
    title: 'Revisar y enviar',
    description: 'Verificá que las fotos sean claras y legibles',
    icon: Check,
  },
  submitting: {
    title: 'Enviando...',
    description: 'Subiendo tus documentos para verificación',
    icon: Upload,
  },
  complete: {
    title: 'Verificación enviada',
    description: 'Tu verificación ha sido enviada correctamente',
    icon: CheckCircle,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function SelfieVerification({
  userId,
  onComplete,
  onCancel,
  requireDniBack = false,
  className,
}: SelfieVerificationProps) {
  const [currentStep, setCurrentStep] = useState<Step>('dni_front');
  const [stepData, setStepData] = useState<StepData>({
    dniFront: { blob: null, path: null },
    dniBack: { blob: null, path: null },
    selfie: { blob: null, path: null },
  });
  const [error, setError] = useState<string | null>(null);
  const [sessionId] = useState(() => `session_${Date.now()}_${Math.random().toString(36).slice(2)}`);

  // ─────────────────────────────────────────────────────────────────────────────
  // STEP NAVIGATION
  // ─────────────────────────────────────────────────────────────────────────────

  const steps = useMemo(() => {
    const baseSteps: Step[] = ['dni_front'];
    if (requireDniBack) baseSteps.push('dni_back');
    baseSteps.push('selfie', 'review');
    return baseSteps;
  }, [requireDniBack]);

  const currentStepIndex = steps.indexOf(currentStep);

  const canGoBack = currentStepIndex > 0 && currentStep !== 'submitting' && currentStep !== 'complete';
  const canGoNext = (() => {
    if (currentStep === 'dni_front') return !!stepData.dniFront.blob;
    if (currentStep === 'dni_back') return !!stepData.dniBack.blob;
    if (currentStep === 'selfie') return !!stepData.selfie.blob;
    if (currentStep === 'review') return true;
    return false;
  })();

  const goBack = useCallback(() => {
    if (!canGoBack) return;
    setCurrentStep(steps[currentStepIndex - 1]);
  }, [canGoBack, steps, currentStepIndex]);

  const goNext = useCallback(() => {
    if (!canGoNext) return;
    if (currentStep === 'review') {
      submitVerification();
    } else {
      setCurrentStep(steps[currentStepIndex + 1]);
    }
  }, [canGoNext, currentStep, steps, currentStepIndex]);

  // ─────────────────────────────────────────────────────────────────────────────
  // DNI UPLOAD HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  const handleDniUpload = useCallback(
    (type: 'dniFront' | 'dniBack') => (result: { submissionId: string; path?: string }) => {
      // For DNI uploads, we get the path from the upload endpoint
      // We also need to store a preview, so fetch it back
      setStepData((prev) => ({
        ...prev,
        [type]: {
          blob: null, // We don't have the blob after server upload
          path: result.path || null,
        },
      }));

      // Auto-advance to next step
      setTimeout(() => {
        if (type === 'dniFront' && !requireDniBack) {
          setCurrentStep('selfie');
        } else if (type === 'dniFront') {
          setCurrentStep('dni_back');
        } else {
          setCurrentStep('selfie');
        }
      }, 500);
    },
    [requireDniBack]
  );

  // ─────────────────────────────────────────────────────────────────────────────
  // SELFIE HANDLING
  // ─────────────────────────────────────────────────────────────────────────────

  const handleSelfieCapture = useCallback(async (blob: Blob) => {
    // Store the blob for preview
    setStepData((prev) => ({
      ...prev,
      selfie: { blob, path: null },
    }));

    // Advance to review
    setCurrentStep('review');
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // SUBMISSION
  // ─────────────────────────────────────────────────────────────────────────────

  const submitVerification = useCallback(async () => {
    setCurrentStep('submitting');
    setError(null);

    try {
      // Upload selfie if we have a blob (not yet uploaded)
      if (stepData.selfie.blob && !stepData.selfie.path) {
        const formData = new FormData();
        formData.append('file', stepData.selfie.blob, 'selfie.jpg');
        formData.append('requirementCode', 'identity_selfie');
        if (userId) formData.append('userId', userId);

        const response = await fetch('/api/verification/upload', {
          method: 'POST',
          body: formData,
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          throw new Error(result.error || 'Error al subir selfie');
        }

        setStepData((prev) => ({
          ...prev,
          selfie: { ...prev.selfie, path: result.path },
        }));
      }

      // All uploads complete
      setCurrentStep('complete');

      onComplete?.({
        success: true,
        paths: {
          dniFront: stepData.dniFront.path || undefined,
          dniBack: stepData.dniBack.path || undefined,
          selfie: stepData.selfie.path || undefined,
        },
      });
    } catch (err) {
      console.error('Verification submission error:', err);
      setError(err instanceof Error ? err.message : 'Error al enviar verificación');
      setCurrentStep('review'); // Go back to review on error
    }
  }, [stepData, userId, onComplete]);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  const renderStepIndicator = () => (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center">
          <div
            className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
              index < currentStepIndex
                ? 'bg-success-500 text-white'
                : index === currentStepIndex
                ? 'bg-primary-600 text-white'
                : 'bg-gray-200 text-gray-500'
            )}
          >
            {index < currentStepIndex ? (
              <Check className="h-4 w-4" />
            ) : (
              index + 1
            )}
          </div>
          {index < steps.length - 1 && (
            <div
              className={cn(
                'w-8 h-0.5 mx-1',
                index < currentStepIndex ? 'bg-success-500' : 'bg-gray-200'
              )}
            />
          )}
        </div>
      ))}
    </div>
  );

  const renderStepContent = () => {
    const config = STEP_CONFIG[currentStep];
    const Icon = config.icon;

    return (
      <div className="mb-6">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-3">
            <Icon className="h-6 w-6 text-primary-600" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900">{config.title}</h3>
          <p className="text-sm text-gray-500">{config.description}</p>
        </div>

        {/* DNI Front Upload */}
        {currentStep === 'dni_front' && (
          <DocumentUpload
            requirementCode="dni_front"
            userId={userId}
            onUploadComplete={handleDniUpload('dniFront')}
            onUploadError={(err) => setError(err)}
            label="Subir foto del DNI (frente)"
            helpText="La foto debe mostrar claramente todos los datos"
          />
        )}

        {/* DNI Back Upload */}
        {currentStep === 'dni_back' && (
          <DocumentUpload
            requirementCode="dni_back"
            userId={userId}
            onUploadComplete={handleDniUpload('dniBack')}
            onUploadError={(err) => setError(err)}
            label="Subir foto del DNI (dorso)"
            helpText="La foto debe mostrar claramente todos los datos"
          />
        )}

        {/* Selfie Capture */}
        {currentStep === 'selfie' && (
          <SelfieCapture
            mode="selfie_with_dni"
            onCapture={handleSelfieCapture}
            onCancel={onCancel}
            showGuides
          />
        )}

        {/* Review */}
        {currentStep === 'review' && (
          <div className="space-y-4">
            {/* DNI Front preview */}
            {stepData.dniFront.path && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b">
                  <span className="text-sm font-medium text-gray-700">DNI (Frente)</span>
                </div>
                <div className="h-40 bg-gray-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-success-500" />
                </div>
              </div>
            )}

            {/* DNI Back preview */}
            {requireDniBack && stepData.dniBack.path && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b">
                  <span className="text-sm font-medium text-gray-700">DNI (Dorso)</span>
                </div>
                <div className="h-40 bg-gray-100 flex items-center justify-center">
                  <Check className="h-8 w-8 text-success-500" />
                </div>
              </div>
            )}

            {/* Selfie preview */}
            {stepData.selfie.blob && (
              <div className="border rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 border-b">
                  <span className="text-sm font-medium text-gray-700">Selfie con DNI</span>
                </div>
                <img
                  src={URL.createObjectURL(stepData.selfie.blob)}
                  alt="Selfie"
                  className="w-full h-40 object-cover"
                />
              </div>
            )}
          </div>
        )}

        {/* Submitting */}
        {currentStep === 'submitting' && (
          <div className="flex flex-col items-center justify-center py-8">
            <Loader2 className="h-10 w-10 text-primary-600 animate-spin mb-4" />
            <p className="text-gray-600">Subiendo documentos...</p>
          </div>
        )}

        {/* Complete */}
        {currentStep === 'complete' && (
          <div className="flex flex-col items-center justify-center py-8">
            <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mb-4">
              <CheckCircle className="h-8 w-8 text-success-600" />
            </div>
            <p className="text-gray-900 font-medium mb-2">Verificación enviada</p>
            <p className="text-sm text-gray-500 text-center">
              Tu verificación de identidad ha sido enviada. Te notificaremos cuando sea revisada.
            </p>
          </div>
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <div className={cn('bg-white rounded-lg shadow-sm p-6', className)}>
      {/* Step indicator */}
      {currentStep !== 'complete' && currentStep !== 'submitting' && renderStepIndicator()}

      {/* Error message */}
      {error && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-2 text-danger-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Step content */}
      {renderStepContent()}

      {/* Navigation buttons */}
      {currentStep !== 'submitting' && currentStep !== 'complete' && (
        <div className="flex items-center justify-between pt-4 border-t">
          <button
            onClick={canGoBack ? goBack : onCancel}
            className="flex items-center gap-1 px-4 py-2 text-gray-600 hover:text-gray-900 transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            {canGoBack ? 'Anterior' : 'Cancelar'}
          </button>

          {currentStep !== 'selfie' && (
            <button
              onClick={goNext}
              disabled={!canGoNext}
              className={cn(
                'flex items-center gap-1 px-6 py-2 rounded-lg font-medium transition-colors',
                canGoNext
                  ? 'bg-primary-600 text-white hover:bg-primary-700'
                  : 'bg-gray-100 text-gray-400 cursor-not-allowed'
              )}
            >
              {currentStep === 'review' ? 'Enviar verificación' : 'Siguiente'}
              <ChevronRight className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      {/* Complete actions */}
      {currentStep === 'complete' && (
        <div className="flex justify-center pt-4 border-t">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}

export default SelfieVerification;
