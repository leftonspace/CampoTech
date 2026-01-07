'use client';

/**
 * Profile Detail Modal Component
 * ==============================
 * 
 * Shows full profile details in a slide-out panel when a profile row is clicked.
 * Uses React Portal to render outside the table DOM to avoid hydration errors.
 */

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
    X,
    Phone,
    Mail,
    MapPin,
    FileText,
    Calendar,
    User,
    ExternalLink,
    Copy,
    Check,
    MessageCircle
} from 'lucide-react';

interface Profile {
    id: string;
    source: string;
    fullName: string;
    matricula: string | null;
    phone: string | null;
    phones?: string[];           // Multiple phones
    email: string | null;
    profession: string | null;
    province: string | null;
    city: string | null;
    cuit?: string | null;
    address?: string | null;
    postalCode?: string | null;  // CP
    category?: string | null;    // M1, M2, M3
    categoryDesc?: string | null; // Full description
    licenseExpiry?: Date | string | null;  // VIGENCIA
    claimedAt: Date | null;
    createdAt: Date;
    scrapedAt?: Date;
    whatsappStatus?: string;
}

interface ProfileDetailProps {
    profile: Profile | null;
    onClose: () => void;
}

const SOURCE_LABELS: Record<string, string> = {
    ERSEP: 'ERSEP (Córdoba)',
    CACAAV: 'CACAAV (Nacional)',
    GASNOR: 'Gasnor (Norte)',
    GASNEA: 'GasNEA (NEA)',
    ENARGAS: 'ENARGAS (Nacional)',
    MANUAL: 'Manual',
};

export function ProfileDetailModal({ profile, onClose }: ProfileDetailProps) {
    const [copied, setCopied] = useState<string | null>(null);
    const [mounted, setMounted] = useState(false);

    // Wait for client-side mount before rendering portal
    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    if (!profile || !mounted) return null;

    const copyToClipboard = (text: string, field: string) => {
        navigator.clipboard.writeText(text);
        setCopied(field);
        setTimeout(() => setCopied(null), 2000);
    };

    const openWhatsApp = () => {
        if (profile.phone) {
            const cleanPhone = profile.phone.replace(/[^0-9+]/g, '');
            window.open(`https://wa.me/${cleanPhone}`, '_blank');
        }
    };

    // Use createPortal to render modal at document.body level
    // This prevents the hydration error from having <div> inside <tbody>
    return createPortal(
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/30 z-40"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white shadow-xl z-50 overflow-y-auto">
                {/* Header */}
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-gray-900">Detalle del Perfil</h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 space-y-6">
                    {/* Name & Basic Info */}
                    <div className="text-center pb-6 border-b border-gray-100">
                        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                            <User className="w-8 h-8 text-emerald-600" />
                        </div>
                        <h3 className="text-xl font-semibold text-gray-900">{profile.fullName}</h3>
                        <p className="text-sm text-gray-500 mt-1">{profile.profession || 'Profesional'}</p>
                        <div className="flex items-center justify-center gap-2 mt-2">
                            <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                                {SOURCE_LABELS[profile.source] || profile.source}
                            </span>
                            {profile.claimedAt ? (
                                <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded text-xs">
                                    Reclamado
                                </span>
                            ) : (
                                <span className="px-2 py-1 bg-emerald-100 text-emerald-700 rounded text-xs">
                                    Disponible
                                </span>
                            )}
                        </div>
                    </div>

                    {/* Contact Information */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Información de Contacto</h4>
                        <div className="space-y-3">
                            {/* Phones - show all phones if available */}
                            {(profile.phones && profile.phones.length > 0 ? profile.phones : (profile.phone ? [profile.phone] : [])).map((phoneNum, idx) => (
                                <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Phone className="w-5 h-5 text-emerald-500" />
                                        <div>
                                            <p className="text-xs text-gray-500">Teléfono {(profile.phones?.length || 0) > 1 ? `#${idx + 1}` : ''}</p>
                                            <p className="font-medium text-gray-900">{phoneNum}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={(e) => { e.stopPropagation(); copyToClipboard(phoneNum, `phone${idx}`); }}
                                            className="p-2 hover:bg-gray-200 rounded transition-colors"
                                            title="Copiar"
                                        >
                                            {copied === `phone${idx}` ? (
                                                <Check className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                const cleanPhone = phoneNum.replace(/[^0-9+]/g, '');
                                                window.open(`https://wa.me/${cleanPhone}`, '_blank');
                                            }}
                                            className="p-2 hover:bg-emerald-100 rounded transition-colors"
                                            title="Abrir WhatsApp"
                                        >
                                            <MessageCircle className="w-4 h-4 text-emerald-500" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                            {(!profile.phone && (!profile.phones || profile.phones.length === 0)) && (
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <div className="flex items-center gap-3">
                                        <Phone className="w-5 h-5 text-gray-400" />
                                        <p className="text-gray-400">No disponible</p>
                                    </div>
                                </div>
                            )}

                            {/* Email */}
                            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <Mail className="w-5 h-5 text-blue-500" />
                                    <div>
                                        <p className="text-xs text-gray-500">Email</p>
                                        <p className="font-medium text-gray-900">
                                            {profile.email || 'No disponible'}
                                        </p>
                                    </div>
                                </div>
                                {profile.email && (
                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => copyToClipboard(profile.email!, 'email')}
                                            className="p-2 hover:bg-gray-200 rounded transition-colors"
                                            title="Copiar"
                                        >
                                            {copied === 'email' ? (
                                                <Check className="w-4 h-4 text-emerald-500" />
                                            ) : (
                                                <Copy className="w-4 h-4 text-gray-400" />
                                            )}
                                        </button>
                                        <a
                                            href={`mailto:${profile.email}`}
                                            className="p-2 hover:bg-blue-100 rounded transition-colors"
                                            title="Enviar email"
                                        >
                                            <ExternalLink className="w-4 h-4 text-blue-500" />
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Location */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Ubicación</h4>
                        <div className="p-3 bg-gray-50 rounded-lg">
                            <div className="flex items-start gap-3">
                                <MapPin className="w-5 h-5 text-orange-500 mt-0.5" />
                                <div>
                                    {profile.city && <p className="font-medium text-gray-900">{profile.city}</p>}
                                    {profile.province && <p className="text-sm text-gray-600">{profile.province}</p>}
                                    {profile.address && <p className="text-sm text-gray-500 mt-1">{profile.address}</p>}
                                    {!profile.city && !profile.province && (
                                        <p className="text-gray-400">No disponible</p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Professional Details */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Datos Profesionales</h4>
                        <div className="grid grid-cols-2 gap-3">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-500">Matrícula</p>
                                <p className="font-medium text-gray-900">{profile.matricula || '-'}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-500">CUIT</p>
                                <p className="font-medium text-gray-900">{profile.cuit || '-'}</p>
                            </div>
                            {profile.category && (
                                <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                                    <p className="text-xs text-gray-500">Categoría</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className={`px-2 py-1 rounded text-xs font-medium ${profile.category === 'M1' ? 'bg-purple-100 text-purple-700' :
                                            profile.category === 'M2' ? 'bg-blue-100 text-blue-700' :
                                                'bg-green-100 text-green-700'
                                            }`}>
                                            {profile.category}
                                        </span>
                                        <span className="text-sm text-gray-700">
                                            {profile.categoryDesc || (
                                                profile.category === 'M1' ? '1ra Categoría - Industrial' :
                                                    profile.category === 'M2' ? '2da Categoría - Residencial/Comercial' :
                                                        '3ra Categoría - Artefactos individuales'
                                            )}
                                        </span>
                                    </div>
                                </div>
                            )}
                            {profile.licenseExpiry && (
                                <div className="p-3 bg-gray-50 rounded-lg col-span-2">
                                    <p className="text-xs text-gray-500">Vigencia (Vence)</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        {(() => {
                                            const expiry = new Date(profile.licenseExpiry);
                                            const now = new Date();
                                            const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                                            const isExpired = daysUntilExpiry < 0;
                                            const isExpiringSoon = daysUntilExpiry <= 90 && daysUntilExpiry >= 0;

                                            return (
                                                <>
                                                    <span className={`px-2 py-1 rounded text-xs font-medium ${isExpired ? 'bg-red-100 text-red-700' :
                                                        isExpiringSoon ? 'bg-amber-100 text-amber-700' :
                                                            'bg-green-100 text-green-700'
                                                        }`}>
                                                        {isExpired ? 'VENCIDA' : isExpiringSoon ? 'POR VENCER' : 'VIGENTE'}
                                                    </span>
                                                    <span className="font-medium text-gray-900">
                                                        {expiry.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                                    </span>
                                                    {isExpiringSoon && !isExpired && (
                                                        <span className="text-xs text-amber-600">
                                                            ({daysUntilExpiry} días)
                                                        </span>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Metadata */}
                    <div>
                        <h4 className="text-sm font-medium text-gray-700 mb-3">Información del Sistema</h4>
                        <div className="space-y-2 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Calendar className="w-4 h-4" />
                                <span>Importado: {new Date(profile.createdAt).toLocaleDateString('es-AR')}</span>
                            </div>
                            {profile.scrapedAt && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <FileText className="w-4 h-4" />
                                    <span>Scrapeado: {new Date(profile.scrapedAt).toLocaleDateString('es-AR')}</span>
                                </div>
                            )}
                            {profile.whatsappStatus && (
                                <div className="flex items-center gap-2 text-gray-600">
                                    <MessageCircle className="w-4 h-4" />
                                    <span>WhatsApp: {profile.whatsappStatus}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="pt-4 border-t border-gray-100">
                        <div className="flex gap-3">
                            {profile.phone && (
                                <button
                                    onClick={openWhatsApp}
                                    className="flex-1 py-2 px-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <MessageCircle className="w-4 h-4" />
                                    Contactar por WhatsApp
                                </button>
                            )}
                            {profile.email && (
                                <a
                                    href={`mailto:${profile.email}`}
                                    className="flex-1 py-2 px-4 bg-blue-500 hover:bg-blue-600 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                                >
                                    <Mail className="w-4 h-4" />
                                    Enviar Email
                                </a>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </>,
        document.body
    );
}

// Row component that wraps the profile row
interface ProfileRowProps {
    profile: Profile;
    sourceLabel: string;
}

export function ProfileRow({ profile, sourceLabel }: ProfileRowProps) {
    const [showDetail, setShowDetail] = useState(false);

    return (
        <>
            <tr
                className="hover:bg-gray-50 cursor-pointer"
                onClick={() => setShowDetail(true)}
            >
                <td className="px-4 py-3">
                    <div>
                        <p className="font-medium text-gray-900">{profile.fullName}</p>
                        <p className="text-xs text-gray-500">{profile.matricula}</p>
                    </div>
                </td>
                <td className="px-4 py-3">
                    <span className="px-2 py-1 bg-gray-100 rounded text-xs text-gray-700">
                        {sourceLabel}
                    </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                    {profile.profession || '-'}
                </td>
                <td className="px-4 py-3">
                    <div className="text-gray-600">
                        {profile.city && <p>{profile.city}</p>}
                        {profile.province && <p className="text-xs text-gray-500">{profile.province}</p>}
                        {!profile.city && !profile.province && '-'}
                    </div>
                </td>
                <td className="px-4 py-3">
                    <div className="space-y-1">
                        {profile.phone && (
                            <p className="text-xs text-gray-700 flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-500" />
                                <span className="truncate max-w-[120px]">{profile.phone}</span>
                            </p>
                        )}
                        {profile.email && (
                            <p className="text-xs text-gray-700 flex items-center gap-1">
                                <Mail className="w-3 h-3 text-blue-500" />
                                <span className="truncate max-w-[120px]">{profile.email}</span>
                            </p>
                        )}
                        {!profile.phone && !profile.email && (
                            <span className="text-gray-400">-</span>
                        )}
                    </div>
                </td>
                <td className="px-4 py-3 text-center">
                    {profile.claimedAt ? (
                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-purple-100 text-purple-700 rounded-full text-xs">
                            Reclamado
                        </span>
                    ) : (
                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                            Disponible
                        </span>
                    )}
                </td>
            </tr>

            {showDetail && (
                <ProfileDetailModal
                    profile={profile}
                    onClose={() => setShowDetail(false)}
                />
            )}
        </>
    );
}
