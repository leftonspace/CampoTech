'use client';

/**
 * Admin Verification Queue Page
 * =============================
 *
 * Platform-level moderation for matrícula and badge verification submissions.
 * Only accessible by CampoTech admins (SUPER_ADMIN role).
 *
 * Features:
 * - View pending verification submissions (Tier 4 badges)
 * - Approve/Reject submissions
 * - View uploaded documents
 * - Search registry for matches
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
    ArrowLeft,
    CheckCircle,
    XCircle,
    Clock,
    Search,
    FileText,
    ExternalLink,
    Building,
    Filter,
    RefreshCw,
    AlertCircle,
    Flame,
    Zap,
    Droplet,
    Snowflake,
} from 'lucide-react';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import { formatDisplayDate } from '@/lib/timezone';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface VerificationSubmission {
    id: string;
    organizationId: string;
    organizationName: string;
    userId: string | null;
    userName: string | null;
    requirementCode: string;
    requirementName: string;
    specialty: string | null;
    submittedValue: string | null; // The matricula number
    documentUrl: string | null;
    status: 'pending' | 'in_review' | 'approved' | 'rejected';
    submittedAt: string;
    expiresAt: string | null;
}

interface QueueStats {
    pending: number;
    inReview: number;
    approvedToday: number;
    rejectedToday: number;
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
    return SPECIALTY_ICONS[code] || FileText;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

interface QueueResponse {
    success: boolean;
    submissions: VerificationSubmission[];
    stats: QueueStats;
}

async function fetchVerificationQueue(filter: string): Promise<{
    submissions: VerificationSubmission[];
    stats: QueueStats;
}> {
    const response = await apiRequest<QueueResponse>(`/admin/verification-queue?filter=${filter}`);
    // Response might be wrapped in data or direct
    const data = ('data' in response && response.data) ? response.data : response as unknown as QueueResponse;

    return {
        submissions: data?.submissions || [],
        stats: data?.stats || { pending: 0, inReview: 0, approvedToday: 0, rejectedToday: 0 },
    };
}

async function approveSubmission(id: string): Promise<{ success: boolean; message?: string }> {
    const response = await apiRequest<{ success: boolean; message?: string }>(`/admin/verification-queue/${id}/approve`, {
        method: 'POST',
    });
    return ('data' in response && response.data) ? response.data : response as unknown as { success: boolean; message?: string };
}

async function rejectSubmission(
    id: string,
    reason: string
): Promise<{ success: boolean; message?: string }> {
    const response = await apiRequest<{ success: boolean; message?: string }>(`/admin/verification-queue/${id}/reject`, {
        method: 'POST',
        body: { reason },
    });
    return ('data' in response && response.data) ? response.data : response as unknown as { success: boolean; message?: string };
}

interface RegistrySearchResult {
    id: string;
    matricula: string;
    specialty: string;
    source: string;
    fullName: string | null;
    province: string | null;
    status: string;
    scrapedAt: string;
}

interface RegistrySearchResponse {
    results: RegistrySearchResult[];
    total: number;
}

async function searchRegistry(
    query: string,
    specialty?: string,
    source?: string
): Promise<RegistrySearchResponse> {
    const params = new URLSearchParams({ q: query });
    if (specialty) params.set('specialty', specialty);
    if (source) params.set('source', source);

    const response = await apiRequest<RegistrySearchResponse>(`/admin/verification-queue/registry-search?${params.toString()}`);
    return ('data' in response && response.data) ? response.data : response as unknown as RegistrySearchResponse;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function RegistrySearchPanel() {
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<RegistrySearchResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [hasSearched, setHasSearched] = useState(false);

    const handleSearch = async () => {
        if (searchQuery.length < 2) return;

        setIsSearching(true);
        setHasSearched(true);
        try {
            const data = await searchRegistry(searchQuery);
            setSearchResults(data.results || []);
        } catch (error) {
            console.error('Search error:', error);
            setSearchResults([]);
        } finally {
            setIsSearching(false);
        }
    };

    return (
        <div className="card p-4 border-l-4 border-l-primary-500">
            <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Search className="h-4 w-4" />
                Buscar en Registro
            </h3>
            <p className="text-sm text-gray-500 mb-3">
                Buscá matrículas en la base de datos para verificar si existen en los registros oficiales.
            </p>

            <div className="flex gap-2">
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    placeholder="Buscar por matrícula o nombre..."
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm"
                />
                <button
                    onClick={handleSearch}
                    disabled={searchQuery.length < 2 || isSearching}
                    className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                    {isSearching ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                        <Search className="h-4 w-4" />
                    )}
                    Buscar
                </button>
            </div>

            {/* Results */}
            {hasSearched && (
                <div className="mt-4">
                    {searchResults.length === 0 ? (
                        <p className="text-sm text-gray-500 italic">
                            No se encontraron resultados para &quot;{searchQuery}&quot;
                        </p>
                    ) : (
                        <div className="space-y-2 max-h-64 overflow-y-auto">
                            <p className="text-xs text-gray-500 mb-2">
                                {searchResults.length} resultado(s) encontrado(s)
                            </p>
                            {searchResults.map((result) => (
                                <div
                                    key={result.id}
                                    className="p-3 bg-gray-50 rounded-lg text-sm"
                                >
                                    <div className="flex items-center justify-between">
                                        <span className="font-mono font-semibold text-gray-900">
                                            {result.matricula}
                                        </span>
                                        <span className="px-2 py-0.5 bg-success-100 text-success-700 rounded text-xs">
                                            {result.source}
                                        </span>
                                    </div>
                                    {result.fullName && (
                                        <p className="text-gray-600 mt-1">{result.fullName}</p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                        <span>{result.specialty}</span>
                                        {result.province && (
                                            <>
                                                <span>•</span>
                                                <span>{result.province}</span>
                                            </>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function StatsCards({ stats }: { stats: QueueStats }) {
    return (
        <div className="grid grid-cols-4 gap-4 mb-6">
            <div className="card p-4 border-l-4 border-l-amber-500">
                <div className="flex items-center gap-3">
                    <Clock className="h-8 w-8 text-amber-500" />
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
                        <p className="text-sm text-gray-500">Pendientes</p>
                    </div>
                </div>
            </div>

            <div className="card p-4 border-l-4 border-l-blue-500">
                <div className="flex items-center gap-3">
                    <Search className="h-8 w-8 text-blue-500" />
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.inReview}</p>
                        <p className="text-sm text-gray-500">En Revisión</p>
                    </div>
                </div>
            </div>

            <div className="card p-4 border-l-4 border-l-success-500">
                <div className="flex items-center gap-3">
                    <CheckCircle className="h-8 w-8 text-success-500" />
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.approvedToday}</p>
                        <p className="text-sm text-gray-500">Aprobados Hoy</p>
                    </div>
                </div>
            </div>

            <div className="card p-4 border-l-4 border-l-danger-500">
                <div className="flex items-center gap-3">
                    <XCircle className="h-8 w-8 text-danger-500" />
                    <div>
                        <p className="text-2xl font-bold text-gray-900">{stats.rejectedToday}</p>
                        <p className="text-sm text-gray-500">Rechazados Hoy</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

function SubmissionCard({
    submission,
    onApprove,
    onReject,
    isProcessing,
}: {
    submission: VerificationSubmission;
    onApprove: (id: string) => void;
    onReject: (id: string, reason: string) => void;
    isProcessing: boolean;
}) {
    const [showRejectModal, setShowRejectModal] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const Icon = getSpecialtyIcon(submission.requirementCode);

    const handleReject = () => {
        if (rejectReason.trim()) {
            onReject(submission.id, rejectReason);
            setShowRejectModal(false);
            setRejectReason('');
        }
    };

    return (
        <div className="card p-4 hover:shadow-md transition-shadow">
            <div className="flex items-start gap-4">
                {/* Icon */}
                <div className="p-3 rounded-xl bg-gray-100">
                    <Icon className="h-6 w-6 text-gray-600" />
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <h3 className="font-semibold text-gray-900">{submission.requirementName}</h3>
                            <p className="text-sm text-gray-500 flex items-center gap-1">
                                <Building className="h-3.5 w-3.5" />
                                {submission.organizationName}
                            </p>
                        </div>
                        <span
                            className={cn(
                                'px-2 py-1 rounded-full text-xs font-medium',
                                submission.status === 'pending'
                                    ? 'bg-amber-100 text-amber-700'
                                    : submission.status === 'in_review'
                                        ? 'bg-blue-100 text-blue-700'
                                        : 'bg-gray-100 text-gray-700'
                            )}
                        >
                            {submission.status === 'pending'
                                ? 'Pendiente'
                                : submission.status === 'in_review'
                                    ? 'En Revisión'
                                    : submission.status}
                        </span>
                    </div>

                    {/* Matricula info */}
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-gray-500">Matrícula:</span>
                            <span className="font-mono font-semibold text-gray-900">
                                {submission.submittedValue || 'Sin valor'}
                            </span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                            <Clock className="h-3 w-3" />
                            Enviado: {formatDisplayDate(new Date(submission.submittedAt), {
                                day: 'numeric',
                                month: 'short',
                                year: 'numeric',
                                hour: '2-digit',
                                minute: '2-digit',
                            })}
                        </div>
                    </div>

                    {/* Document preview */}
                    {submission.documentUrl && (
                        <div className="mt-3">
                            <a
                                href={submission.documentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700"
                            >
                                <FileText className="h-4 w-4" />
                                Ver Documento
                                <ExternalLink className="h-3 w-3" />
                            </a>
                        </div>
                    )}

                    {/* Actions */}
                    <div className="mt-4 flex items-center gap-2">
                        <button
                            onClick={() => onApprove(submission.id)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 bg-success-600 text-white rounded-lg hover:bg-success-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <CheckCircle className="h-4 w-4" />
                            Aprobar
                        </button>
                        <button
                            onClick={() => setShowRejectModal(true)}
                            disabled={isProcessing}
                            className="flex items-center gap-2 px-4 py-2 border border-danger-300 text-danger-600 rounded-lg hover:bg-danger-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <XCircle className="h-4 w-4" />
                            Rechazar
                        </button>
                    </div>
                </div>
            </div>

            {/* Reject Modal */}
            {showRejectModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">
                            Rechazar Verificación
                        </h3>
                        <p className="text-sm text-gray-600 mb-4">
                            Por favor, indicá el motivo del rechazo. El usuario verá este mensaje.
                        </p>
                        <textarea
                            value={rejectReason}
                            onChange={(e) => setRejectReason(e.target.value)}
                            placeholder="Ej: Matrícula no encontrada en el registro oficial de Gasnor"
                            className="w-full p-3 border border-gray-200 rounded-lg resize-none h-24 text-sm"
                        />
                        <div className="flex justify-end gap-2 mt-4">
                            <button
                                onClick={() => {
                                    setShowRejectModal(false);
                                    setRejectReason('');
                                }}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleReject}
                                disabled={!rejectReason.trim()}
                                className="px-4 py-2 bg-danger-600 text-white rounded-lg hover:bg-danger-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                            >
                                Confirmar Rechazo
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ═══════════════════════════════════════════════════════════════════════════════

export default function VerificationQueuePage() {
    const [filter, setFilter] = useState<string>('pending');
    const queryClient = useQueryClient();

    // Fetch queue
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ['verification-queue', filter],
        queryFn: () => fetchVerificationQueue(filter),
    });

    // Approve mutation
    const approveMutation = useMutation({
        mutationFn: approveSubmission,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
        },
    });

    // Reject mutation
    const rejectMutation = useMutation({
        mutationFn: ({ id, reason }: { id: string; reason: string }) =>
            rejectSubmission(id, reason),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['verification-queue'] });
        },
    });

    const handleApprove = (id: string) => {
        approveMutation.mutate(id);
    };

    const handleReject = (id: string, reason: string) => {
        rejectMutation.mutate({ id, reason });
    };

    const isProcessing = approveMutation.isPending || rejectMutation.isPending;

    return (
        <div className="mx-auto max-w-6xl space-y-6">
            {/* Header */}
            <div className="flex items-center gap-4">
                <Link
                    href="/dashboard/admin"
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                >
                    <ArrowLeft className="h-5 w-5" />
                </Link>
                <div className="flex-1">
                    <h1 className="text-2xl font-bold text-gray-900">
                        Cola de Verificación de Matrículas
                    </h1>
                    <p className="text-gray-500">
                        Revisa y aprueba solicitudes de badges profesionales
                    </p>
                </div>
                <button
                    onClick={() => refetch()}
                    className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
                    title="Actualizar"
                >
                    <RefreshCw className="h-5 w-5" />
                </button>
            </div>

            {/* Info banner */}
            <div className="rounded-lg bg-blue-50 border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5" />
                    <div className="text-sm text-blue-700">
                        <p className="font-medium">¿Cómo verificar matrículas?</p>
                        <p className="mt-1">
                            CampoTech verifica matrículas contra registros públicos oficiales de ERSEP, Gasnor,
                            GasNea y CACAAV. Si la matrícula figura en el registro, aprobá. Si no la encontrás,
                            rechazá indicando el motivo.
                        </p>
                    </div>
                </div>
            </div>

            {/* Registry Search */}
            <RegistrySearchPanel />

            {/* Stats */}
            {data?.stats && <StatsCards stats={data.stats} />}

            {/* Filters */}
            <div className="card p-4">
                <div className="flex items-center gap-4">
                    <Filter className="h-5 w-5 text-gray-400" />
                    <div className="flex gap-2">
                        {[
                            { value: 'pending', label: 'Pendientes' },
                            { value: 'in_review', label: 'En Revisión' },
                            { value: 'all', label: 'Todos' },
                        ].map((f) => (
                            <button
                                key={f.value}
                                onClick={() => setFilter(f.value)}
                                className={cn(
                                    'px-3 py-1.5 rounded-lg text-sm font-medium transition-colors',
                                    filter === f.value
                                        ? 'bg-primary-100 text-primary-700'
                                        : 'text-gray-600 hover:bg-gray-100'
                                )}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Loading */}
            {isLoading && (
                <div className="flex h-64 items-center justify-center">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="rounded-md bg-danger-50 p-4 text-danger-700">
                    Error al cargar la cola de verificación. Por favor, intentá de nuevo.
                </div>
            )}

            {/* Queue */}
            {data && !isLoading && (
                <div className="space-y-4">
                    {data.submissions.length === 0 ? (
                        <div className="card p-12 text-center">
                            <CheckCircle className="h-12 w-12 mx-auto text-gray-300 mb-4" />
                            <h3 className="text-lg font-medium text-gray-900">
                                No hay verificaciones pendientes
                            </h3>
                            <p className="text-gray-500 mt-1">
                                Todas las solicitudes han sido procesadas.
                            </p>
                        </div>
                    ) : (
                        data.submissions.map((submission) => (
                            <SubmissionCard
                                key={submission.id}
                                submission={submission}
                                onApprove={handleApprove}
                                onReject={handleReject}
                                isProcessing={isProcessing}
                            />
                        ))
                    )}
                </div>
            )}
        </div>
    );
}
