'use client';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import {
  Smartphone,
  Bot,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Loader2,
} from 'lucide-react';
import { NumberSelector } from './NumberSelector';
import { VerificationStep } from './VerificationStep';
import { SetupSuccess } from './SetupSuccess';

export type WizardStep =
  | 'choose-type'
  | 'select-number'
  | 'verify'
  | 'success';

export type IntegrationType = 'personal' | 'bsp';

interface SetupWizardProps {
  subscriptionTier: string;
  canUseBsp: boolean;
  currentPersonalNumber?: string;
}

export function SetupWizard({
  subscriptionTier: _subscriptionTier,
  canUseBsp,
  currentPersonalNumber,
}: SetupWizardProps) {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState<WizardStep>('choose-type');
  const [integrationType, setIntegrationType] = useState<IntegrationType | null>(null);
  const [selectedNumber, setSelectedNumber] = useState<string | null>(null);
  const [personalNumber, setPersonalNumber] = useState(currentPersonalNumber || '');
  const [provisionedNumber, setProvisionedNumber] = useState<string | null>(null);

  // Save personal number mutation
  const savePersonalMutation = useMutation({
    mutationFn: async (number: string) => {
      const res = await fetch('/api/settings/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalNumber: number }),
      });
      if (!res.ok) throw new Error('Failed to save');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
      setProvisionedNumber(personalNumber);
      setStep('success');
    },
  });

  // Start BSP provisioning mutation
  const provisionMutation = useMutation({
    mutationFn: async (phoneNumber: string) => {
      const res = await fetch('/api/whatsapp/provision', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to provision');
      }
      return res.json();
    },
    onSuccess: (data) => {
      if (data.nextStep === 'VERIFY_CODE') {
        setStep('verify');
      } else {
        setProvisionedNumber(data.phoneNumber);
        setStep('success');
      }
    },
  });

  const handleChooseType = (type: IntegrationType) => {
    setIntegrationType(type);
    if (type === 'personal') {
      // Show personal number input in the same step
    } else if (type === 'bsp' && canUseBsp) {
      setStep('select-number');
    }
  };

  const handleSavePersonal = () => {
    if (personalNumber) {
      savePersonalMutation.mutate(personalNumber);
    }
  };

  const handleSelectNumber = (number: string) => {
    setSelectedNumber(number);
  };

  const handleProvision = () => {
    if (selectedNumber) {
      provisionMutation.mutate(selectedNumber);
    }
  };

  const handleVerificationComplete = (phoneNumber: string) => {
    setProvisionedNumber(phoneNumber);
    queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
    setStep('success');
  };

  const handleFinish = () => {
    router.push('/dashboard/settings/whatsapp');
  };

  const handleBack = () => {
    switch (step) {
      case 'select-number':
        setStep('choose-type');
        setIntegrationType(null);
        break;
      case 'verify':
        setStep('select-number');
        break;
      default:
        router.push('/dashboard/settings/whatsapp');
    }
  };

  return (
    <div className="mx-auto max-w-2xl">
      {/* Progress indicator */}
      {step !== 'success' && (
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <button
              onClick={handleBack}
              className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="h-4 w-4" />
              Volver
            </button>
            <div className="flex items-center gap-2">
              <StepIndicator
                step={1}
                label="Tipo"
                active={step === 'choose-type'}
                completed={step !== 'choose-type'}
              />
              {integrationType === 'bsp' && (
                <>
                  <div className="w-8 h-0.5 bg-gray-200" />
                  <StepIndicator
                    step={2}
                    label="Número"
                    active={step === 'select-number'}
                    completed={step === 'verify'}
                  />
                  <div className="w-8 h-0.5 bg-gray-200" />
                  <StepIndicator
                    step={3}
                    label="Verificar"
                    active={step === 'verify'}
                    completed={false}
                  />
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Step Content */}
      {step === 'choose-type' && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">
              Configurar WhatsApp
            </h1>
            <p className="text-gray-600">
              Elegí cómo querés que tus clientes te contacten por WhatsApp
            </p>
          </div>

          {/* Personal Number Option */}
          <div
            className={`card p-6 cursor-pointer transition-all ${integrationType === 'personal'
              ? 'ring-2 ring-primary-500 bg-primary-50'
              : 'hover:border-gray-300'
              }`}
            onClick={() => handleChooseType('personal')}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full p-3 bg-green-100 text-green-600">
                <Smartphone className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    Usar mi número personal
                  </h3>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                    Incluido
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Tus clientes te escriben a tu WhatsApp actual.
                  Vos respondés desde tu celular.
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Botón de WhatsApp en facturas y turnos
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Código QR para tarjetas de visita
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-500" />
                    Sin costo adicional
                  </li>
                </ul>
              </div>
            </div>

            {/* Personal number input (shown when selected) */}
            {integrationType === 'personal' && (
              <div className="mt-4 pt-4 border-t">
                <label className="label mb-2 block">Tu número de WhatsApp</label>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    value={personalNumber}
                    onChange={(e) => setPersonalNumber(e.target.value.replace(/[^\d+\s\-]/g, ''))}
                    placeholder="+54 11 5555-1234"
                    className="input flex-1"
                    onClick={(e) => e.stopPropagation()}
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSavePersonal();
                    }}
                    disabled={!personalNumber || savePersonalMutation.isPending}
                    className="btn-primary"
                  >
                    {savePersonalMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        Guardar
                        <ArrowRight className="h-4 w-4 ml-1" />
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Ingresá tu número con código de país (ej: +54 para Argentina)
                </p>
              </div>
            )}
          </div>

          {/* BSP Number Option */}
          <div
            className={`card p-6 transition-all ${canUseBsp
              ? `cursor-pointer ${integrationType === 'bsp'
                ? 'ring-2 ring-primary-500 bg-primary-50'
                : 'hover:border-gray-300'
              }`
              : 'opacity-75'
              }`}
            onClick={() => canUseBsp && handleChooseType('bsp')}
          >
            <div className="flex items-start gap-4">
              <div className="rounded-full p-3 bg-purple-100 text-purple-600">
                <Bot className="h-6 w-6" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h3 className="text-lg font-medium text-gray-900">
                    Número exclusivo con IA
                  </h3>
                  {!canUseBsp && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      Plan Profesional
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mb-3">
                  Te asignamos un número de WhatsApp exclusivo para tu negocio.
                  La IA responde automáticamente las 24 horas.
                </p>
                <ul className="text-sm text-gray-500 space-y-1">
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Número exclusivo para tu negocio
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    IA que responde automáticamente
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Historial de todas las conversaciones
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-purple-500" />
                    Creación automática de turnos
                  </li>
                </ul>

                {!canUseBsp && (
                  <a
                    href="/dashboard/settings/billing"
                    className="mt-4 inline-flex items-center text-sm text-purple-600 hover:text-purple-700"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Actualizar a Plan Profesional
                    <ArrowRight className="h-4 w-4 ml-1" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {step === 'select-number' && (
        <NumberSelector
          selectedNumber={selectedNumber}
          onSelectNumber={handleSelectNumber}
          onContinue={handleProvision}
          isLoading={provisionMutation.isPending}
          error={provisionMutation.error?.message}
        />
      )}

      {step === 'verify' && selectedNumber && (
        <VerificationStep
          phoneNumber={selectedNumber}
          onVerified={handleVerificationComplete}
          onBack={() => setStep('select-number')}
        />
      )}

      {step === 'success' && provisionedNumber && (
        <SetupSuccess
          phoneNumber={provisionedNumber}
          integrationType={integrationType!}
          onFinish={handleFinish}
        />
      )}
    </div>
  );
}

function StepIndicator({
  step,
  label,
  active,
  completed,
}: {
  step: number;
  label: string;
  active: boolean;
  completed: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${active
          ? 'bg-primary-500 text-white'
          : completed
            ? 'bg-green-500 text-white'
            : 'bg-gray-200 text-gray-500'
          }`}
      >
        {completed ? <CheckCircle className="h-5 w-5" /> : step}
      </div>
      <span
        className={`text-sm ${active ? 'text-gray-900 font-medium' : 'text-gray-500'
          }`}
      >
        {label}
      </span>
    </div>
  );
}
