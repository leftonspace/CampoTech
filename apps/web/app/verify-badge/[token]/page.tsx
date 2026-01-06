/**
 * Badge Verification Public Page
 * ===============================
 * 
 * Phase 4.3 Task 4.3.3: Badge Verification Public Endpoint
 * 
 * /verify-badge/[token] - Public page for security guards
 * 
 * When a security guard scans the QR code, they see:
 * - Technician name and photo
 * - Company name and logo
 * - ART insurance status
 * - Background check status
 * - Verification timestamp
 */

import { Metadata } from 'next';
import { getDigitalBadgeService } from '@/lib/services/digital-badge.service';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const metadata: Metadata = {
    title: 'Verificación de Credencial | CampoTech',
    description: 'Verificá la identidad y credenciales de un técnico',
};

// Force dynamic rendering (no caching for security)
export const dynamic = 'force-dynamic';

interface PageProps {
    params: Promise<{ token: string }>;
}

export default async function BadgeVerificationPage({ params }: PageProps) {
    const { token } = await params;

    const badgeService = getDigitalBadgeService();
    const result = await badgeService.verifyBadge(token);

    // Not found
    if (result.notFound) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
                    <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Credencial No Encontrada</h1>
                    <p className="text-gray-600">
                        El código QR escaneado no corresponde a ninguna credencial registrada.
                    </p>
                </div>
            </div>
        );
    }

    // Expired
    if (result.expired) {
        return (
            <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 text-center">
                    <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h1 className="text-xl font-bold text-gray-900 mb-2">Credencial Expirada</h1>
                    <p className="text-gray-600">
                        Esta credencial ha expirado. El técnico debe renovarla desde la aplicación.
                    </p>
                </div>
            </div>
        );
    }

    const badge = result.badge!;
    const verification = badge.verification;

    // Helper to get status display
    const getARTStatusDisplay = () => {
        switch (verification.artStatus) {
            case 'valid':
                return {
                    icon: '✅',
                    text: 'ART Vigente',
                    color: 'text-green-600',
                    bg: 'bg-green-50',
                };
            case 'expiring':
                return {
                    icon: '⚠️',
                    text: 'ART Por Vencer',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                };
            case 'expired':
                return {
                    icon: '❌',
                    text: 'ART Vencida',
                    color: 'text-red-600',
                    bg: 'bg-red-50',
                };
            case 'missing':
                return {
                    icon: '❓',
                    text: 'Sin ART Registrada',
                    color: 'text-gray-600',
                    bg: 'bg-gray-50',
                };
        }
    };

    const getBackgroundCheckDisplay = () => {
        switch (verification.backgroundCheck) {
            case 'approved':
                return {
                    icon: '✅',
                    text: 'Antecedentes Verificados',
                    color: 'text-green-600',
                    bg: 'bg-green-50',
                };
            case 'pending':
                return {
                    icon: '⏳',
                    text: 'Verificación Pendiente',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                };
            case 'rejected':
                return {
                    icon: '❌',
                    text: 'Verificación Rechazada',
                    color: 'text-red-600',
                    bg: 'bg-red-50',
                };
            case 'expired':
                return {
                    icon: '⚠️',
                    text: 'Verificación Expirada',
                    color: 'text-amber-600',
                    bg: 'bg-amber-50',
                };
            default:
                return {
                    icon: '❓',
                    text: 'Sin Verificar',
                    color: 'text-gray-600',
                    bg: 'bg-gray-50',
                };
        }
    };

    const artStatus = getARTStatusDisplay();
    const bgCheckStatus = getBackgroundCheckDisplay();

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className={`p-6 ${badge.isValid ? 'bg-green-500' : 'bg-amber-500'} text-white`}>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                            {badge.isValid ? (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            ) : (
                                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                            )}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold">
                                {badge.isValid ? 'VERIFICACIÓN DE ACCESO' : 'VERIFICACIÓN PARCIAL'}
                            </h1>
                            <p className="text-sm opacity-90">
                                {badge.isValid ? 'Credencial válida' : 'Revisar documentación'}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Technician Info */}
                <div className="p-6 border-b">
                    <div className="flex items-center gap-4">
                        {badge.technician.photo ? (
                            <img
                                src={badge.technician.photo}
                                alt={badge.technician.name}
                                className="w-20 h-20 rounded-full object-cover border-2 border-gray-200"
                            />
                        ) : (
                            <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl font-bold text-gray-500">
                                {badge.technician.name.charAt(0).toUpperCase()}
                            </div>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">{badge.technician.name}</h2>
                            {badge.technician.specialty && (
                                <p className="text-gray-600">{badge.technician.specialty}</p>
                            )}
                            <div className="flex items-center gap-2 mt-1">
                                {badge.organization.logo ? (
                                    <img
                                        src={badge.organization.logo}
                                        alt={badge.organization.name}
                                        className="w-5 h-5 rounded"
                                    />
                                ) : null}
                                <span className="text-sm text-gray-500">{badge.organization.name}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Verification Status */}
                <div className="p-6 space-y-4">
                    {/* ART Status */}
                    <div className={`rounded-lg p-4 ${artStatus.bg}`}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{artStatus.icon}</span>
                            <div>
                                <p className={`font-semibold ${artStatus.color}`}>{artStatus.text}</p>
                                {verification.artProvider && (
                                    <p className="text-sm text-gray-600">
                                        {verification.artProvider}
                                        {verification.artExpiry && (
                                            <> - Vence {format(new Date(verification.artExpiry), "dd/MM/yyyy", { locale: es })}</>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Background Check Status */}
                    <div className={`rounded-lg p-4 ${bgCheckStatus.bg}`}>
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">{bgCheckStatus.icon}</span>
                            <div>
                                <p className={`font-semibold ${bgCheckStatus.color}`}>{bgCheckStatus.text}</p>
                                {verification.backgroundCheckDate && (
                                    <p className="text-sm text-gray-600">
                                        Verificado el {format(new Date(verification.backgroundCheckDate), "dd/MM/yyyy", { locale: es })}
                                        {verification.backgroundCheckProvider && (
                                            <> por {verification.backgroundCheckProvider}</>
                                        )}
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t">
                    <div className="flex items-center justify-between text-sm text-gray-500">
                        <span>🕐 Verificado</span>
                        <span>{format(result.verifiedAt, "dd/MM/yyyy HH:mm", { locale: es })}</span>
                    </div>
                    <div className="mt-2 text-center">
                        <span className="text-xs text-gray-400">
                            Credencial emitida por CampoTech
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
