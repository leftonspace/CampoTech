'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { ProtectedRoute } from '@/lib/auth-context';
import {
    Phone,
    Plus,
    RefreshCcw,
    CheckCircle,
    XCircle,
    Clock,
    Building2,
    DollarSign,
    BarChart3,
    ChevronRight,
    ChevronLeft,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InventoryStats {
    total: number;
    available: number;
    reserved: number;
    assigned: number;
    suspended: number;
    released: number;
    totalMonthlyCostUsd: number;
    avgCostPerNumber: number;
    utilizationRate: number;
}

interface NumberRecord {
    id: string;
    phoneNumber: string;
    phoneNumberFormatted: string | null;
    countryCode: string;
    bspProvider: string;
    status: 'available' | 'reserved' | 'assigned' | 'suspended' | 'released';
    assignedToOrgId: string | null;
    assignedAt: string | null;
    lastActivityAt: string | null;
    messageCountTotal: number;
    messageCountMonth: number;
    monthlyRentalCostUsd: number;
    notes: string | null;
    createdAt: string;
    assignedOrg?: { id: string; name: string } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function NumberInventoryPage() {
    return (
        <ProtectedRoute allowedRoles={['OWNER']}>
            <NumberInventoryContent />
        </ProtectedRoute>
    );
}

function NumberInventoryContent() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [showProvisionModal, setShowProvisionModal] = useState(false);

    // Fetch stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['number-inventory-stats'],
        queryFn: () => fetch('/api/admin/number-inventory?action=stats').then(r => r.json()),
        refetchInterval: 30000,
    });

    // Fetch numbers list
    const { data: numbersData, isLoading: numbersLoading } = useQuery({
        queryKey: ['number-inventory-list', page, statusFilter],
        queryFn: () => {
            const params = new URLSearchParams();
            params.set('action', 'list');
            params.set('page', page.toString());
            params.set('limit', '20');
            if (statusFilter) params.set('status', statusFilter);
            return fetch(`/api/admin/number-inventory?${params}`).then(r => r.json());
        },
        refetchInterval: 60000,
    });

    // Auto-release mutation
    const autoReleaseMutation = useMutation({
        mutationFn: () => fetch('/api/admin/number-inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'auto_release' }),
        }).then(r => r.json()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['number-inventory-stats'] });
            queryClient.invalidateQueries({ queryKey: ['number-inventory-list'] });
        },
    });

    // Recycle mutation
    const recycleMutation = useMutation({
        mutationFn: () => fetch('/api/admin/number-inventory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'recycle' }),
        }).then(r => r.json()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['number-inventory-stats'] });
            queryClient.invalidateQueries({ queryKey: ['number-inventory-list'] });
        },
    });

    const stats: InventoryStats | undefined = statsData?.stats;
    const numbers: NumberRecord[] = numbersData?.numbers || [];
    const totalPages = numbersData?.totalPages || 1;

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">
                        📱 Inventario de Números WhatsApp
                    </h1>
                    <p className="text-gray-500">
                        Gestión de números pre-comprados para asignación instantánea
                    </p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => recycleMutation.mutate()}
                        disabled={recycleMutation.isPending}
                        className="btn-outline flex items-center gap-2"
                    >
                        <RefreshCcw className={cn('h-4 w-4', recycleMutation.isPending && 'animate-spin')} />
                        Reciclar
                    </button>
                    <button
                        onClick={() => autoReleaseMutation.mutate()}
                        disabled={autoReleaseMutation.isPending}
                        className="btn-outline flex items-center gap-2"
                    >
                        <Clock className="h-4 w-4" />
                        Auto-liberar
                    </button>
                    <button
                        onClick={() => setShowProvisionModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="h-4 w-4" />
                        Provisionar
                    </button>
                </div>
            </div>

            {/* Stats cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
                <StatCard
                    title="Total"
                    value={stats?.total ?? '-'}
                    icon={Phone}
                    color="blue"
                    loading={statsLoading}
                />
                <StatCard
                    title="Disponibles"
                    value={stats?.available ?? '-'}
                    icon={CheckCircle}
                    color="green"
                    loading={statsLoading}
                />
                <StatCard
                    title="Asignados"
                    value={stats?.assigned ?? '-'}
                    icon={Building2}
                    color="purple"
                    loading={statsLoading}
                />
                <StatCard
                    title="Reservados"
                    value={stats?.reserved ?? '-'}
                    icon={Clock}
                    color="yellow"
                    loading={statsLoading}
                />
                <StatCard
                    title="Costo Mensual"
                    value={stats ? `$${stats.totalMonthlyCostUsd.toFixed(0)} USD` : '-'}
                    icon={DollarSign}
                    color="green"
                    loading={statsLoading}
                />
                <StatCard
                    title="Utilización"
                    value={stats ? `${stats.utilizationRate.toFixed(1)}%` : '-'}
                    icon={BarChart3}
                    color="blue"
                    loading={statsLoading}
                />
            </div>

            {/* Status breakdown */}
            {stats && (
                <div className="card p-4">
                    <h3 className="mb-3 font-medium text-gray-900">Distribución por Estado</h3>
                    <div className="flex h-8 overflow-hidden rounded-lg">
                        <StatusBar
                            status="available"
                            count={stats.available}
                            total={stats.total}
                            color="bg-green-500"
                        />
                        <StatusBar
                            status="assigned"
                            count={stats.assigned}
                            total={stats.total}
                            color="bg-purple-500"
                        />
                        <StatusBar
                            status="reserved"
                            count={stats.reserved}
                            total={stats.total}
                            color="bg-yellow-500"
                        />
                        <StatusBar
                            status="suspended"
                            count={stats.suspended}
                            total={stats.total}
                            color="bg-red-500"
                        />
                        <StatusBar
                            status="released"
                            count={stats.released}
                            total={stats.total}
                            color="bg-gray-400"
                        />
                    </div>
                    <div className="mt-2 flex flex-wrap gap-4 text-sm">
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-green-500" /> Disponibles ({stats.available})
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-purple-500" /> Asignados ({stats.assigned})
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-yellow-500" /> Reservados ({stats.reserved})
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-red-500" /> Suspendidos ({stats.suspended})
                        </span>
                        <span className="flex items-center gap-1">
                            <span className="h-3 w-3 rounded bg-gray-400" /> Liberados ({stats.released})
                        </span>
                    </div>
                </div>
            )}

            {/* Numbers list */}
            <div className="card">
                <div className="card-header flex flex-row items-center justify-between">
                    <h2 className="card-title text-lg">Números en Inventario</h2>
                    <div className="flex items-center gap-2">
                        <select
                            value={statusFilter}
                            onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            className="rounded border px-3 py-1 text-sm"
                        >
                            <option value="">Todos los estados</option>
                            <option value="available">Disponibles</option>
                            <option value="assigned">Asignados</option>
                            <option value="reserved">Reservados</option>
                            <option value="suspended">Suspendidos</option>
                            <option value="released">Liberados</option>
                        </select>
                    </div>
                </div>
                <div className="card-content">
                    {numbersLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3, 4, 5].map((i) => (
                                <div key={i} className="h-14 animate-pulse rounded bg-gray-100" />
                            ))}
                        </div>
                    ) : numbers.length === 0 ? (
                        <div className="py-12 text-center text-gray-500">
                            <Phone className="mx-auto h-12 w-12 text-gray-300" />
                            <p className="mt-2">No hay números en el inventario</p>
                            <button
                                onClick={() => setShowProvisionModal(true)}
                                className="mt-4 text-primary-600 hover:underline"
                            >
                                Provisionar números →
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="divide-y">
                                {numbers.map((number) => (
                                    <NumberRow key={number.id} number={number} />
                                ))}
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="mt-4 flex items-center justify-between">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="btn-outline flex items-center gap-1 disabled:opacity-50"
                                    >
                                        <ChevronLeft className="h-4 w-4" /> Anterior
                                    </button>
                                    <span className="text-sm text-gray-500">
                                        Página {page} de {totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                                        disabled={page === totalPages}
                                        className="btn-outline flex items-center gap-1 disabled:opacity-50"
                                    >
                                        Siguiente <ChevronRight className="h-4 w-4" />
                                    </button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* Provision Modal */}
            {showProvisionModal && (
                <ProvisionModal onClose={() => setShowProvisionModal(false)} />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({
    title,
    value,
    icon: Icon,
    color,
    loading,
}: {
    title: string;
    value: string | number;
    icon: React.ElementType;
    color: string;
    loading?: boolean;
}) {
    const colorClasses: Record<string, string> = {
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        yellow: 'bg-yellow-100 text-yellow-600',
        red: 'bg-red-100 text-red-600',
        purple: 'bg-purple-100 text-purple-600',
    };

    return (
        <div className="card p-4">
            <div className="flex items-center gap-3">
                <div className={cn('rounded-full p-2', colorClasses[color])}>
                    <Icon className="h-5 w-5" />
                </div>
                <div>
                    <p className="text-sm text-gray-500">{title}</p>
                    <p className="text-xl font-bold text-gray-900">
                        {loading ? '...' : value}
                    </p>
                </div>
            </div>
        </div>
    );
}

function StatusBar({
    status,
    count,
    total,
    color,
}: {
    status: string;
    count: number;
    total: number;
    color: string;
}) {
    const percentage = total > 0 ? (count / total) * 100 : 0;
    if (percentage === 0) return null;

    return (
        <div
            className={cn('flex items-center justify-center text-xs text-white', color)}
            style={{ width: `${percentage}%` }}
            title={`${status}: ${count}`}
        >
            {percentage > 10 && count}
        </div>
    );
}

function NumberRow({ number }: { number: NumberRecord }) {
    const statusConfig = {
        available: { label: 'Disponible', color: 'text-green-600 bg-green-50', icon: CheckCircle },
        assigned: { label: 'Asignado', color: 'text-purple-600 bg-purple-50', icon: Building2 },
        reserved: { label: 'Reservado', color: 'text-yellow-600 bg-yellow-50', icon: Clock },
        suspended: { label: 'Suspendido', color: 'text-red-600 bg-red-50', icon: XCircle },
        released: { label: 'Liberado', color: 'text-gray-600 bg-gray-50', icon: RefreshCcw },
    };

    const config = statusConfig[number.status];

    return (
        <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gray-100">
                    <Phone className="h-5 w-5 text-gray-500" />
                </div>
                <div>
                    <p className="font-medium text-gray-900">
                        {number.phoneNumberFormatted || number.phoneNumber}
                    </p>
                    <p className="text-sm text-gray-500">
                        {number.bspProvider} · {number.countryCode}
                        {number.assignedOrg && (
                            <> · <span className="text-purple-600">{number.assignedOrg.name}</span></>
                        )}
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-4">
                <div className="text-right text-sm">
                    <p className="text-gray-500">
                        {number.messageCountMonth} msg/mes · {number.messageCountTotal} total
                    </p>
                    {number.lastActivityAt && (
                        <p className="text-xs text-gray-400">
                            Última actividad: {formatDistanceToNow(new Date(number.lastActivityAt), {
                                addSuffix: true,
                                locale: es
                            })}
                        </p>
                    )}
                </div>

                <span className={cn(
                    'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-medium',
                    config.color
                )}>
                    <config.icon className="h-3 w-3" />
                    {config.label}
                </span>
            </div>
        </div>
    );
}

function ProvisionModal({ onClose }: { onClose: () => void }) {
    const queryClient = useQueryClient();
    const [phoneNumber, setPhoneNumber] = useState('');
    const [bspProvider, setBspProvider] = useState('twilio');
    const [bulkNumbers, setBulkNumbers] = useState('');
    const [mode, setMode] = useState<'single' | 'bulk'>('single');

    const provisionMutation = useMutation({
        mutationFn: (data: { action: string; number?: object; numbers?: object[] }) =>
            fetch('/api/admin/number-inventory', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data),
            }).then(r => r.json()),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['number-inventory-stats'] });
            queryClient.invalidateQueries({ queryKey: ['number-inventory-list'] });
            onClose();
        },
    });

    const handleSubmit = () => {
        if (mode === 'single') {
            provisionMutation.mutate({
                action: 'provision',
                number: { phoneNumber, bspProvider },
            });
        } else {
            const numbers = bulkNumbers
                .split('\n')
                .map(line => line.trim())
                .filter(line => line)
                .map(phoneNumber => ({ phoneNumber, bspProvider }));

            provisionMutation.mutate({
                action: 'bulk_provision',
                numbers,
            });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
                <h2 className="mb-4 text-lg font-bold text-gray-900">
                    Provisionar Números WhatsApp
                </h2>

                {/* Mode tabs */}
                <div className="mb-4 flex gap-2">
                    <button
                        onClick={() => setMode('single')}
                        className={cn(
                            'rounded px-4 py-2 text-sm font-medium',
                            mode === 'single' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                        )}
                    >
                        Número único
                    </button>
                    <button
                        onClick={() => setMode('bulk')}
                        className={cn(
                            'rounded px-4 py-2 text-sm font-medium',
                            mode === 'bulk' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-600'
                        )}
                    >
                        Múltiples números
                    </button>
                </div>

                {/* BSP Provider */}
                <div className="mb-4">
                    <label className="mb-1 block text-sm font-medium text-gray-700">
                        Proveedor BSP
                    </label>
                    <select
                        value={bspProvider}
                        onChange={(e) => setBspProvider(e.target.value)}
                        className="w-full rounded border px-3 py-2"
                    >
                        <option value="twilio">Twilio</option>
                        <option value="dialog360">360dialog</option>
                        <option value="meta_direct">Meta Direct</option>
                    </select>
                </div>

                {mode === 'single' ? (
                    <div className="mb-4">
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Número de teléfono
                        </label>
                        <input
                            type="text"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="+54 351 555-1234"
                            className="w-full rounded border px-3 py-2"
                        />
                    </div>
                ) : (
                    <div className="mb-4">
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Números (uno por línea)
                        </label>
                        <textarea
                            value={bulkNumbers}
                            onChange={(e) => setBulkNumbers(e.target.value)}
                            placeholder={"+54 351 555-1234\n+54 351 555-1235\n+54 351 555-1236"}
                            rows={6}
                            className="w-full rounded border px-3 py-2 font-mono text-sm"
                        />
                        <p className="mt-1 text-xs text-gray-500">
                            {bulkNumbers.split('\n').filter(l => l.trim()).length} números a provisionar
                        </p>
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <button
                        onClick={onClose}
                        className="btn-outline"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={provisionMutation.isPending || (mode === 'single' && !phoneNumber)}
                        className="btn-primary disabled:opacity-50"
                    >
                        {provisionMutation.isPending ? 'Provisionando...' : 'Provisionar'}
                    </button>
                </div>

                {provisionMutation.isError && (
                    <p className="mt-2 text-sm text-red-600">
                        Error: {(provisionMutation.error as Error).message}
                    </p>
                )}
            </div>
        </div>
    );
}
