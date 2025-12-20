'use client';

/**
 * Employee Verification Flow Component
 * =====================================
 *
 * Multi-step verification flow for employees (technicians):
 * 1. CUIL entry with AFIP validation
 * 2. DNI front photo upload
 * 3. Selfie capture holding DNI
 * 4. Phone verification (if not already done)
 *
 * All steps are tracked and can be resumed.
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  User,
  CreditCard,
  Camera,
  Phone,
  Loader2,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { DocumentUpload } from './DocumentUpload';
import { SelfieCapture } from './SelfieCapture';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export interface EmployeeVerificationFlowProps {
  /** Callback when verification is completed */
  onComplete?: () => void;
  /** Callback when cancelled */
  onCancel?: () => void;
  /** Pre-filled steps status */
  completedSteps?: string[];
  /** Whether phone is already verified */
  phoneVerified?: boolean;
  /** Phone number (if already on file) */
  phoneNumber?: string;
  /** Additional class names */
  className?: string;
}

type Step = 'intro' | 'cuil' | 'dni' | 'selfie' | 'phone' | 'complete';

interface StepStatus {
  cuil: 'pending' | 'complete' | 'error';
  dni: 'pending' | 'complete' | 'error';
  selfie: 'pending' | 'complete' | 'error';
  phone: 'pending' | 'complete' | 'error' | 'skipped';
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const STEP_CONFIG = {
  intro: {
    title: 'Verificación de Identidad',
    description: 'Para poder recibir trabajos, necesitamos verificar tu identidad',
    icon: User,
  },
  cuil: {
    title: 'Ingresá tu CUIL',
    description: 'Tu número de CUIL se verificará automáticamente con AFIP',
    icon: User,
  },
  dni: {
    title: 'Foto del DNI',
    description: 'Subí una foto clara del frente de tu DNI',
    icon: CreditCard,
  },
  selfie: {
    title: 'Selfie con DNI',
    description: 'Tomate una selfie sosteniendo tu DNI junto a tu rostro',
    icon: Camera,
  },
  phone: {
    title: 'Verificar Teléfono',
    description: 'Verificá tu número de teléfono con un código SMS',
    icon: Phone,
  },
  complete: {
    title: 'Verificación Enviada',
    description: 'Tu verificación ha sido enviada correctamente',
    icon: CheckCircle,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// CUIL INPUT COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function CUILInput({
  onSubmit,
  isLoading,
  error,
}: {
  onSubmit: (cuil: string) => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [cuil, setCuil] = useState('');

  // Format CUIL as XX-XXXXXXXX-X
  const formatCuil = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCuil(formatCuil(e.target.value));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCuil = cuil.replace(/\D/g, '');
    if (cleanCuil.length === 11) {
      onSubmit(cleanCuil);
    }
  };

  const isValid = cuil.replace(/\D/g, '').length === 11;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="cuil" className="block text-sm font-medium text-gray-700 mb-2">
          Número de CUIL
        </label>
        <input
          id="cuil"
          type="text"
          value={cuil}
          onChange={handleChange}
          placeholder="XX-XXXXXXXX-X"
          className={cn(
            'w-full px-4 py-3 text-center text-lg font-mono border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error ? 'border-danger-500' : 'border-gray-300'
          )}
          disabled={isLoading}
          autoComplete="off"
        />
        <p className="text-xs text-gray-500 mt-2">
          Tu CUIL se encuentra en tu DNI o recibo de sueldo
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={!isValid || isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
          isValid && !isLoading
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Verificando con AFIP...
          </>
        ) : (
          <>
            Verificar CUIL
            <ArrowRight className="h-5 w-5" />
          </>
        )}
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PHONE VERIFICATION COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

function PhoneVerification({
  phoneNumber,
  onVerify,
  onSkip,
  isLoading,
  error,
}: {
  phoneNumber?: string;
  onVerify: (code: string) => void;
  onSkip: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [sendingCode, setSendingCode] = useState(false);

  const handleSendCode = async () => {
    setSendingCode(true);
    try {
      // In a real implementation, this would call an API to send the SMS
      await new Promise((resolve) => setTimeout(resolve, 1500));
      setCodeSent(true);
    } finally {
      setSendingCode(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6) {
      onVerify(code);
    }
  };

  if (!codeSent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-gray-600">
          Enviaremos un código de verificación a tu teléfono
          {phoneNumber && (
            <span className="font-medium block mt-1">{phoneNumber}</span>
          )}
        </p>

        <button
          onClick={handleSendCode}
          disabled={sendingCode}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
        >
          {sendingCode ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Enviando...
            </>
          ) : (
            <>
              <Phone className="h-5 w-5" />
              Enviar código SMS
            </>
          )}
        </button>

        <button
          onClick={onSkip}
          className="text-sm text-gray-500 hover:text-gray-700"
        >
          Verificar después
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="code" className="block text-sm font-medium text-gray-700 mb-2 text-center">
          Ingresá el código de 6 dígitos
        </label>
        <input
          id="code"
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          className={cn(
            'w-full px-4 py-3 text-center text-2xl font-mono tracking-widest border rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500',
            error ? 'border-danger-500' : 'border-gray-300'
          )}
          disabled={isLoading}
          autoComplete="one-time-code"
        />
      </div>

      {error && (
        <div className="flex items-center gap-2 p-3 bg-danger-50 border border-danger-200 rounded-lg text-danger-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <button
        type="submit"
        disabled={code.length !== 6 || isLoading}
        className={cn(
          'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg font-medium transition-colors',
          code.length === 6 && !isLoading
            ? 'bg-primary-600 text-white hover:bg-primary-700'
            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
        )}
      >
        {isLoading ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" />
            Verificando...
          </>
        ) : (
          <>
            Verificar código
            <Check className="h-5 w-5" />
          </>
        )}
      </button>

      <button
        type="button"
        onClick={handleSendCode}
        disabled={sendingCode}
        className="w-full text-sm text-primary-600 hover:text-primary-700"
      >
        Reenviar código
      </button>
    </form>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function EmployeeVerificationFlow({
  onComplete,
  onCancel,
  completedSteps = [],
  phoneVerified = false,
  phoneNumber,
  className,
}: EmployeeVerificationFlowProps) {
  // Determine initial step based on completed steps
  const getInitialStep = (): Step => {
    if (completedSteps.includes('selfie') || completedSteps.includes('identity_selfie')) {
      return phoneVerified ? 'complete' : 'phone';
    }
    if (completedSteps.includes('dni') || completedSteps.includes('dni_front')) {
      return 'selfie';
    }
    if (completedSteps.includes('cuil') || completedSteps.includes('employee_cuil')) {
      return 'dni';
    }
    return 'intro';
  };

  const [currentStep, setCurrentStep] = useState<Step>(getInitialStep);
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    cuil: completedSteps.includes('cuil') || completedSteps.includes('employee_cuil') ? 'complete' : 'pending',
    dni: completedSteps.includes('dni') || completedSteps.includes('dni_front') ? 'complete' : 'pending',
    selfie: completedSteps.includes('selfie') || completedSteps.includes('identity_selfie') ? 'complete' : 'pending',
    phone: phoneVerified ? 'complete' : 'pending',
  });
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Steps for the stepper (excluding intro and complete)
  const steps: Step[] = ['cuil', 'dni', 'selfie'];
  if (!phoneVerified) {
    steps.push('phone');
  }

  const currentStepIndex = steps.indexOf(currentStep);

  // ─────────────────────────────────────────────────────────────────────────────
  // HANDLERS
  // ─────────────────────────────────────────────────────────────────────────────

  const handleCuilSubmit = async (cuil: string) => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/verification/validate-cuit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuit: cuil, type: 'cuil' }),
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al verificar CUIL');
      }

      // Submit CUIL as a verification
      const submitResponse = await fetch('/api/verification/employee/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          requirementCode: 'employee_cuil',
          value: cuil,
        }),
      });

      const submitResult = await submitResponse.json();

      if (!submitResponse.ok || !submitResult.success) {
        throw new Error(submitResult.error || 'Error al guardar CUIL');
      }

      setStepStatus((prev) => ({ ...prev, cuil: 'complete' }));
      setCurrentStep('dni');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al verificar CUIL');
      setStepStatus((prev) => ({ ...prev, cuil: 'error' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handleDniUpload = async (result: { submissionId: string; path?: string }) => {
    setStepStatus((prev) => ({ ...prev, dni: 'complete' }));
    setCurrentStep('selfie');
  };

  const handleSelfieCapture = async (blob: Blob) => {
    setIsLoading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', blob, 'selfie.jpg');
      formData.append('requirementCode', 'identity_selfie');

      const response = await fetch('/api/verification/upload', {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (!response.ok || !result.success) {
        throw new Error(result.error || 'Error al subir selfie');
      }

      setStepStatus((prev) => ({ ...prev, selfie: 'complete' }));

      if (phoneVerified) {
        setCurrentStep('complete');
        onComplete?.();
      } else {
        setCurrentStep('phone');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al subir selfie');
      setStepStatus((prev) => ({ ...prev, selfie: 'error' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneVerify = async (code: string) => {
    setIsLoading(true);
    setError(null);

    try {
      // In a real implementation, this would verify the code
      await new Promise((resolve) => setTimeout(resolve, 1500));

      setStepStatus((prev) => ({ ...prev, phone: 'complete' }));
      setCurrentStep('complete');
      onComplete?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorrecto');
      setStepStatus((prev) => ({ ...prev, phone: 'error' }));
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhoneSkip = () => {
    setStepStatus((prev) => ({ ...prev, phone: 'skipped' }));
    setCurrentStep('complete');
    onComplete?.();
  };

  const goBack = () => {
    if (currentStep === 'cuil') {
      setCurrentStep('intro');
    } else if (currentStepIndex > 0) {
      setCurrentStep(steps[currentStepIndex - 1]);
    }
    setError(null);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const renderStepIndicator = () => {
    if (currentStep === 'intro' || currentStep === 'complete') return null;

    return (
      <div className="flex items-center justify-center gap-2 mb-6">
        {steps.map((step, index) => {
          const status = stepStatus[step as keyof StepStatus];
          return (
            <div key={step} className="flex items-center">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors',
                  status === 'complete'
                    ? 'bg-success-500 text-white'
                    : index === currentStepIndex
                    ? 'bg-primary-600 text-white'
                    : 'bg-gray-200 text-gray-500'
                )}
              >
                {status === 'complete' ? <Check className="h-4 w-4" /> : index + 1}
              </div>
              {index < steps.length - 1 && (
                <div
                  className={cn(
                    'w-8 h-0.5 mx-1',
                    status === 'complete' ? 'bg-success-500' : 'bg-gray-200'
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const config = STEP_CONFIG[currentStep];
  const Icon = config.icon;

  return (
    <div className={cn('bg-white rounded-xl shadow-sm p-6', className)}>
      {/* Step indicator */}
      {renderStepIndicator()}

      {/* Header */}
      <div className="text-center mb-6">
        <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center mx-auto mb-4">
          <Icon
            className={cn(
              'h-8 w-8',
              currentStep === 'complete' ? 'text-success-600' : 'text-primary-600'
            )}
          />
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-1">{config.title}</h2>
        <p className="text-sm text-gray-500">{config.description}</p>
      </div>

      {/* Error message */}
      {error && currentStep !== 'cuil' && currentStep !== 'phone' && (
        <div className="mb-4 p-3 bg-danger-50 border border-danger-200 rounded-lg flex items-center gap-2 text-danger-700">
          <AlertCircle className="h-5 w-5 flex-shrink-0" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* Step content */}
      <div className="mb-6">
        {currentStep === 'intro' && (
          <div className="space-y-4">
            <div className="bg-gray-50 rounded-lg p-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">1</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">CUIL</p>
                  <p className="text-sm text-gray-500">Verificación automática con AFIP</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">2</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">DNI</p>
                  <p className="text-sm text-gray-500">Foto del frente de tu documento</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                  <span className="text-sm font-medium text-primary-700">3</span>
                </div>
                <div>
                  <p className="font-medium text-gray-900">Selfie</p>
                  <p className="text-sm text-gray-500">Foto sosteniendo tu DNI</p>
                </div>
              </div>
              {!phoneVerified && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center">
                    <span className="text-sm font-medium text-primary-700">4</span>
                  </div>
                  <div>
                    <p className="font-medium text-gray-900">Teléfono</p>
                    <p className="text-sm text-gray-500">Verificación por SMS</p>
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => setCurrentStep('cuil')}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Comenzar verificación
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>
        )}

        {currentStep === 'cuil' && (
          <CUILInput onSubmit={handleCuilSubmit} isLoading={isLoading} error={error} />
        )}

        {currentStep === 'dni' && (
          <DocumentUpload
            requirementCode="dni_front"
            onUploadComplete={handleDniUpload}
            onUploadError={(err) => setError(err)}
            label="Subir foto del DNI (frente)"
            helpText="La foto debe mostrar claramente todos los datos"
          />
        )}

        {currentStep === 'selfie' && (
          <SelfieCapture
            mode="selfie_with_dni"
            onCapture={handleSelfieCapture}
            onCancel={() => goBack()}
            showGuides
          />
        )}

        {currentStep === 'phone' && (
          <PhoneVerification
            phoneNumber={phoneNumber}
            onVerify={handlePhoneVerify}
            onSkip={handlePhoneSkip}
            isLoading={isLoading}
            error={error}
          />
        )}

        {currentStep === 'complete' && (
          <div className="text-center space-y-4">
            <div className="w-20 h-20 rounded-full bg-success-100 flex items-center justify-center mx-auto">
              <CheckCircle className="h-10 w-10 text-success-600" />
            </div>
            <div>
              <p className="text-gray-900 font-medium mb-1">
                Tu verificación está siendo procesada
              </p>
              <p className="text-sm text-gray-500">
                Te notificaremos cuando tu verificación sea aprobada y puedas empezar a recibir trabajos.
              </p>
            </div>
            <button
              onClick={onCancel}
              className="px-6 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              Volver al dashboard
            </button>
          </div>
        )}
      </div>

      {/* Navigation */}
      {currentStep !== 'intro' &&
        currentStep !== 'selfie' &&
        currentStep !== 'complete' && (
          <div className="flex items-center justify-between pt-4 border-t">
            <button
              onClick={currentStep === 'cuil' ? onCancel : goBack}
              className="flex items-center gap-1 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
              {currentStep === 'cuil' ? 'Cancelar' : 'Anterior'}
            </button>

            {/* Next button only for DNI step (others have their own submit) */}
            {currentStep === 'dni' && stepStatus.dni === 'complete' && (
              <button
                onClick={() => setCurrentStep('selfie')}
                className="flex items-center gap-1 px-4 py-2 bg-primary-600 text-white rounded-lg font-medium hover:bg-primary-700 transition-colors"
              >
                Siguiente
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
    </div>
  );
}

export default EmployeeVerificationFlow;
