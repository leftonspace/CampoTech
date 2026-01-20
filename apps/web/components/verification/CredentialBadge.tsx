'use client';

/**
 * Credential Badge Component
 * ==========================
 *
 * Displays professional credential badges (matrículas) with different
 * verification levels:
 * - registry_verified: Auto-verified against public registry (Gasnor, ERSEP, etc.)
 * - manually_verified: Manually verified by CampoTech admin
 * - self_declared: Claimed but not yet verified
 *
 * Used in public marketplace profiles and internal verification displays.
 */

import { Flame, Zap, Droplet, Snowflake, Shield, CheckCircle, Info, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

export type VerificationMethod = 'registry' | 'manual' | 'self_declared' | 'pending';

export interface CredentialBadgeData {
    code: string;
    name: string;
    matricula?: string;
    verificationMethod: VerificationMethod;
    source?: string; // GASNOR, ERSEP, etc.
    verifiedAt?: string;
    expiresAt?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// SPECIALTY ICONS
// ═══════════════════════════════════════════════════════════════════════════════

const SPECIALTY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    gas_matricula: Flame,
    electrician_matricula: Zap,
    plumber_matricula: Droplet,
    refrigeration_license: Snowflake,
};

function getSpecialtyIcon(code: string): React.ComponentType<{ className?: string }> {
    return SPECIALTY_ICONS[code] || Shield;
}

// ═══════════════════════════════════════════════════════════════════════════════
// VERIFICATION LEVEL CONFIG
// ═══════════════════════════════════════════════════════════════════════════════

const VERIFICATION_LEVELS: Record<VerificationMethod, {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    bgColor: string;
    textColor: string;
    iconColor: string;
    borderColor: string;
}> = {
    registry: {
        label: 'Verificado',
        description: 'Matrícula verificada en registro oficial',
        icon: CheckCircle,
        bgColor: 'bg-success-50',
        textColor: 'text-success-800',
        iconColor: 'text-success-600',
        borderColor: 'border-success-200',
    },
    manual: {
        label: 'Verificado',
        description: 'Verificado por CampoTech',
        icon: CheckCircle,
        bgColor: 'bg-primary-50',
        textColor: 'text-primary-800',
        iconColor: 'text-primary-600',
        borderColor: 'border-primary-200',
    },
    self_declared: {
        label: 'Declarado',
        description: 'Información proporcionada por el profesional',
        icon: Info,
        bgColor: 'bg-gray-50',
        textColor: 'text-gray-700',
        iconColor: 'text-gray-500',
        borderColor: 'border-gray-200',
    },
    pending: {
        label: 'En revisión',
        description: 'Verificación en proceso',
        icon: AlertCircle,
        bgColor: 'bg-amber-50',
        textColor: 'text-amber-700',
        iconColor: 'text-amber-500',
        borderColor: 'border-amber-200',
    },
};

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: CredentialBadge
// ═══════════════════════════════════════════════════════════════════════════════

interface CredentialBadgeProps {
    credential: CredentialBadgeData;
    size?: 'sm' | 'md' | 'lg';
    showTooltip?: boolean;
    className?: string;
}

export function CredentialBadge({
    credential,
    size = 'md',
    showTooltip = true,
    className,
}: CredentialBadgeProps) {
    const config = VERIFICATION_LEVELS[credential.verificationMethod];
    const SpecialtyIcon = getSpecialtyIcon(credential.code);
    const VerificationIcon = config.icon;

    const sizeClasses = {
        sm: 'px-2 py-1 text-xs gap-1',
        md: 'px-3 py-1.5 text-sm gap-1.5',
        lg: 'px-4 py-2 text-base gap-2',
    };

    const iconSizes = {
        sm: 'h-3 w-3',
        md: 'h-4 w-4',
        lg: 'h-5 w-5',
    };

    // Build tooltip text
    const tooltipText = credential.source
        ? `${config.description} (${credential.source})`
        : config.description;

    return (
        <div
            className={cn(
                'inline-flex items-center rounded-full border',
                sizeClasses[size],
                config.bgColor,
                config.borderColor,
                config.textColor,
                className
            )}
            title={showTooltip ? tooltipText : undefined}
        >
            {/* Specialty Icon */}
            <SpecialtyIcon className={cn(iconSizes[size], config.iconColor)} />

            {/* Name */}
            <span className="font-medium">{credential.name}</span>

            {/* Verification Status Icon */}
            <VerificationIcon className={cn(iconSizes[size], config.iconColor)} />
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: CredentialBadgeList
// ═══════════════════════════════════════════════════════════════════════════════

interface CredentialBadgeListProps {
    credentials: CredentialBadgeData[];
    className?: string;
}

export function CredentialBadgeList({ credentials, className }: CredentialBadgeListProps) {
    if (credentials.length === 0) {
        return null;
    }

    // Group by verification status for display priority
    const registryVerified = credentials.filter((c) => c.verificationMethod === 'registry');
    const manuallyVerified = credentials.filter((c) => c.verificationMethod === 'manual');
    const selfDeclared = credentials.filter((c) => c.verificationMethod === 'self_declared');
    const pending = credentials.filter((c) => c.verificationMethod === 'pending');

    const orderedCredentials = [
        ...registryVerified,
        ...manuallyVerified,
        ...selfDeclared,
        ...pending,
    ];

    return (
        <div className={cn('flex flex-wrap gap-2', className)}>
            {orderedCredentials.map((credential) => (
                <CredentialBadge key={credential.code} credential={credential} />
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: CredentialVerificationCard
// ═══════════════════════════════════════════════════════════════════════════════

interface CredentialVerificationCardProps {
    credential: CredentialBadgeData;
    className?: string;
}

export function CredentialVerificationCard({
    credential,
    className,
}: CredentialVerificationCardProps) {
    const config = VERIFICATION_LEVELS[credential.verificationMethod];
    const SpecialtyIcon = getSpecialtyIcon(credential.code);
    const VerificationIcon = config.icon;

    return (
        <div
            className={cn(
                'flex items-center gap-3 p-3 rounded-lg border',
                config.bgColor,
                config.borderColor,
                className
            )}
        >
            {/* Specialty Icon */}
            <div className={cn('p-2 rounded-full', config.bgColor)}>
                <SpecialtyIcon className={cn('h-5 w-5', config.iconColor)} />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                    <span className={cn('font-medium', config.textColor)}>{credential.name}</span>
                    <VerificationIcon className={cn('h-4 w-4', config.iconColor)} />
                </div>
                {credential.matricula && (
                    <p className="text-xs text-gray-500 font-mono">{credential.matricula}</p>
                )}
                {credential.source && (
                    <p className="text-xs text-gray-500">
                        Verificado en {credential.source}
                    </p>
                )}
            </div>

            {/* Status Label */}
            <span
                className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-medium',
                    config.bgColor,
                    config.textColor
                )}
            >
                {config.label}
            </span>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT: VerificationDisclaimer
// ═══════════════════════════════════════════════════════════════════════════════

interface VerificationDisclaimerProps {
    className?: string;
}

export function VerificationDisclaimer({ className }: VerificationDisclaimerProps) {
    return (
        <div className={cn('text-xs text-gray-500 mt-3 p-3 bg-gray-50 rounded-lg', className)}>
            <p>
                <strong>¿Cómo funcionan las verificaciones?</strong> CampoTech verifica matrículas
                contra registros públicos oficiales de ERSEP, Gasnor, GasNea y CACAAV. Cuando ves
                el badge ✓, significa que el número de matrícula figura en el registro oficial.
            </p>
        </div>
    );
}
