'use client';

/**
 * Profile Claim Verification Page
 * ================================
 * 
 * Phase 4.4: Growth Engine
 * /claim/[id]
 * 
 * Page where users verify ownership of a profile by entering OTP.
 */

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Shield, Phone, Mail, Loader2, CheckCircle2, AlertCircle, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

interface ProfileData {
    id: string;
    fullName: string;
    profession: string | null;
    source: string;
    province: string | null;
    city: string | null;
    matricula: string | null;
    maskedPhone: string | null;
    maskedEmail: string | null;
    isClaimed: boolean;
}

type Step = 'loading' | 'profile' | 'verification' | 'success' | 'error';

export default function ClaimProfileVerifyPage() {
    const params = useParams();
    const router = useRouter();
    const profileId = params.id as string;

    const [step, setStep] = useState<Step>('loading');
    const [profile, setProfile] = useState<ProfileData | null>(null);
    const [verificationMethod, setVerificationMethod] = useState<'phone' | 'email' | null>(null);
    const [maskedContact, setMaskedContact] = useState<string>('');
    const [otp, setOtp] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Load profile data
    useEffect(() => {
        async function loadProfile() {
            try {
                const response = await fetch(`/api/claim-profile/search?q=${profileId}`);
                const data = await response.json();

                if (data.profiles && data.profiles.length > 0) {
                    const found = data.profiles.find((p: ProfileData) => p.id === profileId);
                    if (found) {
                        if (found.isClaimed) {
                            setError('Este perfil ya fue reclamado');
                            setStep('error');
                        } else {
                            setProfile(found);
                            setStep('profile');
                        }
                        return;
                    }
                }

                setError('Perfil no encontrado');
                setStep('error');
            } catch {
                setError('Error al cargar el perfil');
                setStep('error');
            }
        }

        loadProfile();
    }, [profileId]);

    async function handleRequestVerification() {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/claim-profile/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al solicitar verificación');
            }

            setVerificationMethod(data.verificationMethod);
            setMaskedContact(data.maskedContact);
            setStep('verification');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al solicitar verificación');
        } finally {
            setIsSubmitting(false);
        }
    }

    async function handleVerifyOTP() {
        if (otp.length !== 6) {
            setError('El código debe tener 6 dígitos');
            return;
        }

        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch('/api/claim-profile/verify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ profileId, otp }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Error al verificar el código');
            }

            setStep('success');
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Error al verificar el código');
        } finally {
            setIsSubmitting(false);
        }
    }

    function handleOtpChange(value: string) {
        // Only allow digits
        const cleaned = value.replace(/\D/g, '').slice(0, 6);
        setOtp(cleaned);
        setError(null);
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-gray-900 via-gray-900 to-black text-white">
            <div className="max-w-lg mx-auto px-4 py-16">
                {/* Back Link */}
                <Link
                    href="/claim"
                    className="inline-flex items-center gap-2 text-gray-400 hover:text-white mb-8 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Volver a buscar
                </Link>

                {/* Loading */}
                {step === 'loading' && (
                    <div className="text-center py-16">
                        <Loader2 className="w-12 h-12 animate-spin mx-auto text-emerald-500" />
                        <p className="mt-4 text-gray-400">Cargando perfil...</p>
                    </div>
                )}

                {/* Error */}
                {step === 'error' && (
                    <div className="text-center py-16">
                        <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                            <AlertCircle className="w-8 h-8 text-red-400" />
                        </div>
                        <h1 className="text-2xl font-bold mb-2">Error</h1>
                        <p className="text-gray-400">{error}</p>
                        <Link
                            href="/claim"
                            className="inline-block mt-6 px-6 py-3 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                        >
                            Buscar otro perfil
                        </Link>
                    </div>
                )}

                {/* Profile Preview */}
                {step === 'profile' && profile && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                <Shield className="w-10 h-10 text-emerald-400" />
                            </div>
                            <h1 className="text-2xl font-bold">Reclamar perfil</h1>
                            <p className="text-gray-400 mt-2">
                                Verificá que esta información sea correcta
                            </p>
                        </div>

                        {/* Profile Card */}
                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                            <h2 className="text-xl font-semibold mb-4">{profile.fullName}</h2>

                            <div className="space-y-3 text-sm">
                                {profile.matricula && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Matrícula</span>
                                        <span className="font-medium">{profile.matricula}</span>
                                    </div>
                                )}
                                {profile.profession && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Profesión</span>
                                        <span>{profile.profession}</span>
                                    </div>
                                )}
                                {profile.source && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Ente regulador</span>
                                        <span>{profile.source}</span>
                                    </div>
                                )}
                                {(profile.city || profile.province) && (
                                    <div className="flex justify-between">
                                        <span className="text-gray-400">Ubicación</span>
                                        <span>
                                            {[profile.city, profile.province].filter(Boolean).join(', ')}
                                        </span>
                                    </div>
                                )}
                            </div>

                            {/* Contact Info */}
                            <div className="mt-6 pt-4 border-t border-gray-700/50">
                                <p className="text-sm text-gray-400 mb-3">
                                    Enviaremos un código de verificación a:
                                </p>
                                <div className="space-y-2">
                                    {profile.maskedPhone && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Phone className="w-4 h-4 text-emerald-400" />
                                            <span>{profile.maskedPhone}</span>
                                        </div>
                                    )}
                                    {profile.maskedEmail && (
                                        <div className="flex items-center gap-2 text-sm">
                                            <Mail className="w-4 h-4 text-blue-400" />
                                            <span>{profile.maskedEmail}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleRequestVerification}
                            disabled={isSubmitting}
                            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Enviando código...
                                </>
                            ) : (
                                'Enviar código de verificación'
                            )}
                        </button>
                    </div>
                )}

                {/* OTP Verification */}
                {step === 'verification' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <div className="w-20 h-20 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
                                {verificationMethod === 'phone' ? (
                                    <Phone className="w-10 h-10 text-blue-400" />
                                ) : (
                                    <Mail className="w-10 h-10 text-blue-400" />
                                )}
                            </div>
                            <h1 className="text-2xl font-bold">Verificá tu identidad</h1>
                            <p className="text-gray-400 mt-2">
                                Ingresá el código de 6 dígitos enviado a
                            </p>
                            <p className="font-medium mt-1">{maskedContact}</p>
                        </div>

                        {/* OTP Input */}
                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                            <input
                                type="text"
                                inputMode="numeric"
                                value={otp}
                                onChange={(e) => handleOtpChange(e.target.value)}
                                placeholder="000000"
                                className="w-full text-center text-4xl tracking-[0.5em] bg-gray-900/50 border border-gray-700 rounded-lg py-4 text-white placeholder-gray-600 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                maxLength={6}
                                autoFocus
                            />

                            <p className="text-sm text-gray-500 text-center mt-4">
                                El código expira en 15 minutos
                            </p>
                        </div>

                        {error && (
                            <div className="p-4 bg-red-900/30 border border-red-500/50 rounded-lg text-red-200 text-sm">
                                {error}
                            </div>
                        )}

                        <button
                            onClick={handleVerifyOTP}
                            disabled={isSubmitting || otp.length !== 6}
                            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-4 px-6 rounded-lg transition-all flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Verificando...
                                </>
                            ) : (
                                'Verificar código'
                            )}
                        </button>

                        <button
                            onClick={handleRequestVerification}
                            disabled={isSubmitting}
                            className="w-full text-gray-400 hover:text-white py-2 transition-colors text-sm"
                        >
                            ¿No recibiste el código? Reenviar
                        </button>
                    </div>
                )}

                {/* Success */}
                {step === 'success' && (
                    <div className="text-center py-8 space-y-6">
                        <div className="w-20 h-20 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
                            <CheckCircle2 className="w-10 h-10 text-emerald-400" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-bold">¡Perfil reclamado!</h1>
                            <p className="text-gray-400 mt-2">
                                Tu perfil profesional ya está activo y listo para recibir clientes.
                            </p>
                        </div>

                        <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6 text-left space-y-3">
                            <h3 className="font-semibold">Próximos pasos:</h3>
                            <ul className="space-y-2 text-sm text-gray-400">
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                    Completá tu perfil con fotos y descripción
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                    Agregá tus servicios y precios
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 text-emerald-400 mt-0.5 flex-shrink-0" />
                                    Empezá a recibir solicitudes de clientes
                                </li>
                            </ul>
                        </div>

                        <button
                            onClick={() => router.push('/dashboard')}
                            className="w-full bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white font-semibold py-4 px-6 rounded-lg transition-all"
                        >
                            Ir a mi panel
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
