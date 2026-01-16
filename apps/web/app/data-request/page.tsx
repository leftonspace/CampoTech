'use client';

/**
 * ARCO Data Request Page
 * ======================
 * 
 * Phase 4: Public customer-facing data request form
 * 
 * Allows customers to request access to their personal data
 * per Ley 25.326 (Argentina Data Protection Law)
 * 
 * URL: /data-request?org=xxx
 */

import { Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
    Shield,
    Mail,
    Phone,
    User,
    FileText,
    CheckCircle,
    AlertCircle,
    Loader2,
    Lock,
} from 'lucide-react';

// =============================================================================
// TYPES
// =============================================================================

type RequestStep = 'form' | 'verification' | 'success';
type RequestType = 'ACCESS' | 'RECTIFICATION' | 'CANCELLATION' | 'OPPOSITION';

interface FormData {
    requestType: RequestType;
    name: string;
    email: string;
    phone: string;
    dni: string;
    reason: string;
    dataScope: string[];
}

// =============================================================================
// LOADING FALLBACK
// =============================================================================

function DataRequestLoading() {
    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="h-10 w-10 text-teal-600 animate-spin mx-auto mb-4" />
                <p className="text-gray-600">Cargando formulario...</p>
            </div>
        </div>
    );
}

// =============================================================================
// MAIN PAGE WRAPPER (with Suspense)
// =============================================================================

export default function DataRequestPage() {
    return (
        <Suspense fallback={<DataRequestLoading />}>
            <DataRequestContent />
        </Suspense>
    );
}

// =============================================================================
// PAGE CONTENT (uses useSearchParams)
// =============================================================================

function DataRequestContent() {
    const searchParams = useSearchParams();
    const organizationId = searchParams.get('org');

    const [step, setStep] = useState<RequestStep>('form');
    const [requestId, setRequestId] = useState<string>('');
    const [verificationCode, setVerificationCode] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>('');

    const [formData, setFormData] = useState<FormData>({
        requestType: 'ACCESS',
        name: '',
        email: '',
        phone: '',
        dni: '',
        reason: '',
        dataScope: ['all'],
    });

    // Handle form submission
    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!organizationId) {
            setError('Falta el ID de la organización en la URL');
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch('/api/public/data-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    organizationId,
                    requestType: formData.requestType,
                    requesterName: formData.name,
                    requesterEmail: formData.email,
                    requesterPhone: formData.phone || undefined,
                    requesterDni: formData.dni || undefined,
                    requestReason: formData.reason || undefined,
                    dataScope: formData.dataScope,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al enviar la solicitud');
            }

            setRequestId(data.requestId);
            setStep('verification');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    };

    // Handle verification
    const handleVerify = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setIsLoading(true);

        try {
            const response = await fetch('/api/public/data-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'verify',
                    requestId,
                    code: verificationCode,
                }),
            });

            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error || 'Error al verificar');
            }

            setStep('success');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error desconocido');
        } finally {
            setIsLoading(false);
        }
    };

    // No organization error
    if (!organizationId) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-xl shadow-lg p-8 max-w-md text-center">
                    <AlertCircle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Enlace Incompleto</h1>
                    <p className="text-gray-600">
                        Este enlace no contiene la información de la organización.
                        Por favor, contactá directamente a la empresa para solicitar tus datos.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50">
            {/* Header */}
            <div className="bg-gradient-to-r from-teal-600 to-teal-700 text-white py-8">
                <div className="max-w-2xl mx-auto px-4">
                    <div className="flex items-center gap-3 mb-2">
                        <Shield className="h-8 w-8" />
                        <h1 className="text-2xl font-bold">Solicitud de Acceso a Datos</h1>
                    </div>
                    <p className="text-teal-100">
                        Ley 25.326 - Protección de Datos Personales (Argentina)
                    </p>
                </div>
            </div>

            <div className="max-w-2xl mx-auto px-4 py-8">
                {/* Progress Steps */}
                <div className="flex items-center justify-center gap-4 mb-8">
                    {(['form', 'verification', 'success'] as const).map((s, i) => (
                        <div key={s} className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-medium ${step === s
                                ? 'bg-teal-600 text-white'
                                : (['form', 'verification', 'success'].indexOf(step) > i)
                                    ? 'bg-teal-100 text-teal-600'
                                    : 'bg-gray-200 text-gray-500'
                                }`}>
                                {i + 1}
                            </div>
                            <span className={`text-sm hidden sm:inline ${step === s ? 'text-teal-700 font-medium' : 'text-gray-500'
                                }`}>
                                {s === 'form' ? 'Datos' : s === 'verification' ? 'Verificación' : 'Confirmación'}
                            </span>
                            {i < 2 && <div className="w-8 h-0.5 bg-gray-300" />}
                        </div>
                    ))}
                </div>

                {/* Error Message */}
                {error && (
                    <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                        <AlertCircle className="h-5 w-5 text-red-500 mt-0.5" />
                        <div>
                            <p className="font-medium text-red-800">Error</p>
                            <p className="text-red-600 text-sm">{error}</p>
                        </div>
                    </div>
                )}

                {/* Step 1: Form */}
                {step === 'form' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b bg-gray-50">
                            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                                <FileText className="h-5 w-5 text-teal-600" />
                                Información de la Solicitud
                            </h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Completá tus datos para solicitar acceso a tu información personal.
                            </p>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">
                            {/* Request Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Tipo de Solicitud
                                </label>
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { value: 'ACCESS', label: 'Acceso', desc: 'Obtener copia de mis datos' },
                                        { value: 'RECTIFICATION', label: 'Rectificación', desc: 'Corregir datos incorrectos' },
                                        { value: 'CANCELLATION', label: 'Cancelación', desc: 'Eliminar mis datos' },
                                        { value: 'OPPOSITION', label: 'Oposición', desc: 'Objetar el uso de mis datos' },
                                    ].map((type) => (
                                        <label
                                            key={type.value}
                                            className={`p-3 rounded-lg border cursor-pointer transition-colors ${formData.requestType === type.value
                                                ? 'border-teal-500 bg-teal-50'
                                                : 'border-gray-200 hover:border-gray-300'
                                                }`}
                                        >
                                            <input
                                                type="radio"
                                                name="requestType"
                                                value={type.value}
                                                checked={formData.requestType === type.value}
                                                onChange={(e) => setFormData({ ...formData, requestType: e.target.value as RequestType })}
                                                className="sr-only"
                                            />
                                            <span className="font-medium text-gray-900">{type.label}</span>
                                            <p className="text-xs text-gray-500">{type.desc}</p>
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {/* Personal Info */}
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="sm:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <User className="inline h-4 w-4 mr-1" />
                                        Nombre Completo *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="Juan Pérez"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Mail className="inline h-4 w-4 mr-1" />
                                        Email *
                                    </label>
                                    <input
                                        type="email"
                                        required
                                        value={formData.email}
                                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="juan@email.com"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        <Phone className="inline h-4 w-4 mr-1" />
                                        Teléfono
                                    </label>
                                    <input
                                        type="tel"
                                        value={formData.phone}
                                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="+54 11 1234-5678"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        DNI (opcional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.dni}
                                        onChange={(e) => setFormData({ ...formData, dni: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                        placeholder="12.345.678"
                                    />
                                </div>
                            </div>

                            {/* Reason */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Razón de la solicitud (opcional)
                                </label>
                                <textarea
                                    value={formData.reason}
                                    onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    rows={3}
                                    placeholder="Contanos por qué necesitás esta información..."
                                />
                            </div>

                            {/* Legal Notice */}
                            <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
                                <Lock className="inline h-4 w-4 mr-1" />
                                <strong>Información legal:</strong> Tu solicitud será procesada de acuerdo con la
                                Ley 25.326 de Protección de Datos Personales. Tenés derecho a recibir una
                                respuesta dentro de los 10 días hábiles.
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Enviando...
                                    </>
                                ) : (
                                    'Continuar'
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Step 2: Verification */}
                {step === 'verification' && (
                    <div className="bg-white rounded-xl shadow-lg overflow-hidden">
                        <div className="p-6 border-b bg-gray-50 text-center">
                            <div className="w-16 h-16 bg-teal-100 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Mail className="h-8 w-8 text-teal-600" />
                            </div>
                            <h2 className="text-lg font-semibold text-gray-900">Verificá tu Email</h2>
                            <p className="text-sm text-gray-600 mt-1">
                                Te enviamos un código de 6 dígitos a <strong>{formData.email}</strong>
                            </p>
                        </div>

                        <form onSubmit={handleVerify} className="p-6 space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2 text-center">
                                    Código de Verificación
                                </label>
                                <input
                                    type="text"
                                    required
                                    maxLength={6}
                                    value={verificationCode}
                                    onChange={(e) => setVerificationCode(e.target.value.replace(/\D/g, ''))}
                                    className="w-full text-center text-3xl tracking-[1em] py-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                                    placeholder="000000"
                                />
                            </div>

                            <p className="text-sm text-gray-500 text-center">
                                ¿No recibiste el código? Revisá tu carpeta de spam o
                                <button type="button" className="text-teal-600 hover:underline ml-1">
                                    solicitá uno nuevo
                                </button>
                            </p>

                            <button
                                type="submit"
                                disabled={isLoading || verificationCode.length !== 6}
                                className="w-full py-3 bg-teal-600 text-white font-medium rounded-lg hover:bg-teal-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                        Verificando...
                                    </>
                                ) : (
                                    'Verificar'
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 'success' && (
                    <div className="bg-white rounded-xl shadow-lg p-8 text-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="h-10 w-10 text-green-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 mb-2">
                            ¡Solicitud Recibida!
                        </h2>
                        <p className="text-gray-600 mb-6">
                            Tu solicitud de acceso a datos fue verificada exitosamente.
                            Recibirás un email con el enlace de descarga dentro de los
                            próximos <strong>10 días hábiles</strong>.
                        </p>

                        <div className="bg-teal-50 rounded-lg p-4 text-left text-sm">
                            <h3 className="font-medium text-teal-800 mb-2">¿Qué sigue?</h3>
                            <ul className="space-y-2 text-teal-700">
                                <li>✓ Procesaremos tu solicitud</li>
                                <li>✓ Compilaremos los datos solicitados</li>
                                <li>✓ Te enviaremos un email con el enlace de descarga seguro</li>
                                <li>✓ El enlace será válido por 48 horas</li>
                            </ul>
                        </div>
                    </div>
                )}
            </div>

            {/* Footer */}
            <div className="text-center py-8 text-sm text-gray-500">
                <p>Powered by CampoTech</p>
                <p className="mt-1">
                    Ley 25.326 - Protección de Datos Personales (Argentina)
                </p>
            </div>
        </div>
    );
}
