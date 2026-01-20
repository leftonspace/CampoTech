'use client';

/**
 * Inflation Index Administration Dashboard
 * 
 * Phase 4 - Dynamic Pricing (Jan 2026)
 * 
 * Platform admin dashboard for:
 * - Entering monthly CAC/INDEC indices
 * - Viewing historical index data
 * - Triggering notifications to organizations
 */

import { useState, useEffect, useCallback } from 'react';
import {
    TrendingUp,
    Plus,
    X,
    Save,
    Calendar,
    AlertCircle,
    CheckCircle,
    RefreshCw,
    Bell,
    ExternalLink,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InflationIndex {
    id: string;
    source: string;
    label: string;
    period: string;
    rate: number;
    publishedAt: string;
    createdAt: string;
}

interface SourceOption {
    value: string;
    label: string;
}

interface PeriodGroup {
    period: string;
    indices: {
        source: string;
        label: string;
        rate: number;
    }[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CAC_SOURCES = ['CAC_ICC_GENERAL', 'CAC_ICC_MANO_OBRA', 'CAC_ICC_MATERIALES'];
const INDEC_SOURCES = ['INDEC_IPC', 'INDEC_IPC_VIVIENDA'];

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function InflationPage() {
    const [indices, setIndices] = useState<InflationIndex[]>([]);
    const [byPeriod, setByPeriod] = useState<PeriodGroup[]>([]);
    const [sources, setSources] = useState<SourceOption[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'cac' | 'indec'>('cac');

    // Form state
    const [formPeriod, setFormPeriod] = useState(() => {
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        return `${year}-${month}`;
    });
    const [formPublishedAt, setFormPublishedAt] = useState(() => {
        return new Date().toISOString().split('T')[0];
    });
    const [formNotify, setFormNotify] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // CAC form values
    const [cacGeneral, setCacGeneral] = useState('');
    const [cacManoObra, setCacManoObra] = useState('');
    const [cacMateriales, setCacMateriales] = useState('');

    // INDEC form values
    const [indecIpc, setIndecIpc] = useState('');
    const [indecVivienda, setIndecVivienda] = useState('');

    // Fetch indices
    const fetchIndices = useCallback(async () => {
        try {
            const response = await fetch('/api/admin/inflation');
            const data = await response.json();

            if (data.success) {
                setIndices(data.data.indices);
                setByPeriod(data.data.byPeriod);
                setSources(data.data.sources);
                setError(null);
            } else {
                throw new Error(data.error);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch indices');
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchIndices();
    }, [fetchIndices]);

    // Open modal for CAC or INDEC
    const openModal = (mode: 'cac' | 'indec') => {
        setModalMode(mode);
        setShowModal(true);
        // Reset form values
        setCacGeneral('');
        setCacManoObra('');
        setCacMateriales('');
        setIndecIpc('');
        setIndecVivienda('');
    };

    // Submit CAC indices
    const submitCac = async () => {
        setIsSubmitting(true);

        try {
            const entries = [
                { source: 'CAC_ICC_GENERAL', rate: parseFloat(cacGeneral) },
                { source: 'CAC_ICC_MANO_OBRA', rate: parseFloat(cacManoObra) },
                { source: 'CAC_ICC_MATERIALES', rate: parseFloat(cacMateriales) },
            ].filter(e => !isNaN(e.rate));

            for (const entry of entries) {
                const response = await fetch('/api/admin/inflation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: entry.source,
                        period: formPeriod,
                        rate: entry.rate,
                        publishedAt: formPublishedAt,
                        notifyOrgs: formNotify && entry === entries[entries.length - 1], // Only notify on last
                    }),
                });

                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.error);
                }
            }

            setShowModal(false);
            await fetchIndices();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save CAC indices');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Submit INDEC indices
    const submitIndec = async () => {
        setIsSubmitting(true);

        try {
            const entries = [
                { source: 'INDEC_IPC', rate: parseFloat(indecIpc) },
                { source: 'INDEC_IPC_VIVIENDA', rate: parseFloat(indecVivienda) },
            ].filter(e => !isNaN(e.rate));

            for (const entry of entries) {
                const response = await fetch('/api/admin/inflation', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        source: entry.source,
                        period: formPeriod,
                        rate: entry.rate,
                        publishedAt: formPublishedAt,
                        notifyOrgs: formNotify && entry === entries[entries.length - 1],
                    }),
                });

                const data = await response.json();
                if (!data.success) {
                    throw new Error(data.error);
                }
            }

            setShowModal(false);
            await fetchIndices();
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save INDEC indices');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Format period for display
    const formatPeriod = (period: string) => {
        const [year, month] = period.split('-');
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${months[parseInt(month) - 1]} ${year}`;
    };

    // Get color for rate
    const getRateColor = (rate: number) => {
        if (rate <= 2) return 'text-green-600';
        if (rate <= 5) return 'text-amber-600';
        return 'text-red-600';
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Administración de Índices de Inflación</h1>
                    <p className="text-sm text-gray-500">
                        Ingresá los índices CAC/INDEC mensualmente para que las organizaciones ajusten precios
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => openModal('indec')}
                        className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar INDEC
                    </button>
                    <button
                        onClick={() => openModal('cac')}
                        className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                    >
                        <Plus className="h-4 w-4" />
                        Agregar CAC
                    </button>
                </div>
            </div>

            {/* Quick Links */}
            <div className="flex gap-4 text-sm">
                <a
                    href="https://www.camarco.org.ar/estadisticas"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                    <ExternalLink className="h-4 w-4" />
                    CAC Estadísticas
                </a>
                <a
                    href="https://www.indec.gob.ar/indec/web/Nivel4-Tema-3-5-31"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-blue-600 hover:underline"
                >
                    <ExternalLink className="h-4 w-4" />
                    INDEC IPC
                </a>
            </div>

            {/* Error Banner */}
            {error && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                    <div className="flex items-center gap-2 text-red-600">
                        <AlertCircle className="h-5 w-5" />
                        <span className="font-medium">{error}</span>
                    </div>
                </div>
            )}

            {/* Loading State */}
            {isLoading ? (
                <div className="flex items-center justify-center py-12">
                    <RefreshCw className="h-8 w-8 animate-spin text-gray-400" />
                </div>
            ) : (
                <>
                    {/* Period Cards */}
                    {byPeriod.length === 0 ? (
                        <div className="rounded-lg border-2 border-dashed border-gray-300 p-8 text-center">
                            <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                            <h3 className="mt-2 text-lg font-medium text-gray-900">No hay índices cargados</h3>
                            <p className="mt-1 text-sm text-gray-500">Comenzá agregando los índices CAC del mes actual</p>
                            <button
                                onClick={() => openModal('cac')}
                                className="mt-4 rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700"
                            >
                                Agregar Índice CAC
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {byPeriod.map((group) => (
                                <div key={group.period} className="rounded-lg border bg-white">
                                    <div className="border-b px-4 py-3 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Calendar className="h-5 w-5 text-gray-500" />
                                            <h3 className="font-semibold text-gray-900">
                                                {formatPeriod(group.period)}
                                            </h3>
                                        </div>
                                        <span className="text-xs text-gray-500">{group.period}</span>
                                    </div>
                                    <div className="p-4">
                                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                                            {group.indices.map((index) => (
                                                <div
                                                    key={index.source}
                                                    className={`rounded-lg p-3 ${CAC_SOURCES.includes(index.source)
                                                            ? 'bg-blue-50 border border-blue-200'
                                                            : 'bg-purple-50 border border-purple-200'
                                                        }`}
                                                >
                                                    <span className="text-xs text-gray-600">{index.label}</span>
                                                    <p className={`text-xl font-bold ${getRateColor(index.rate)}`}>
                                                        {index.rate.toFixed(1)}%
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Full History Table */}
                    {indices.length > 0 && (
                        <div className="rounded-lg border bg-white">
                            <div className="border-b px-4 py-3">
                                <h3 className="font-semibold text-gray-900">Historial Completo</h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Período</th>
                                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Índice</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Tasa</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Publicado</th>
                                            <th className="px-4 py-2 text-right text-xs font-medium text-gray-500">Cargado</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {indices.slice(0, 20).map((index) => (
                                            <tr key={index.id} className="border-t">
                                                <td className="px-4 py-2 font-medium">{formatPeriod(index.period)}</td>
                                                <td className="px-4 py-2">{index.label}</td>
                                                <td className={`px-4 py-2 text-right font-bold ${getRateColor(index.rate)}`}>
                                                    {index.rate.toFixed(2)}%
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-500">
                                                    {new Date(index.publishedAt).toLocaleDateString('es-AR')}
                                                </td>
                                                <td className="px-4 py-2 text-right text-gray-500">
                                                    {new Date(index.createdAt).toLocaleDateString('es-AR')}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Modal for Adding Indices */}
            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-lg font-semibold">
                                {modalMode === 'cac' ? '📊 Índices CAC' : '📈 Índices INDEC'}
                            </h2>
                            <button
                                onClick={() => setShowModal(false)}
                                className="rounded p-1 hover:bg-gray-100"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Period Selection */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Período
                                    </label>
                                    <input
                                        type="month"
                                        value={formPeriod}
                                        onChange={(e) => setFormPeriod(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Fecha de Publicación
                                    </label>
                                    <input
                                        type="date"
                                        value={formPublishedAt}
                                        onChange={(e) => setFormPublishedAt(e.target.value)}
                                        className="w-full rounded-lg border px-3 py-2"
                                    />
                                </div>
                            </div>

                            {/* CAC Form */}
                            {modalMode === 'cac' && (
                                <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-4">
                                    <h3 className="text-sm font-semibold text-blue-800">
                                        Índice de Costo de la Construcción (CAC)
                                    </h3>
                                    <div className="grid grid-cols-3 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">ICC General (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={cacGeneral}
                                                onChange={(e) => setCacGeneral(e.target.value)}
                                                className="w-full rounded border px-2 py-1.5 text-center"
                                                placeholder="4.2"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Mano de Obra (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={cacManoObra}
                                                onChange={(e) => setCacManoObra(e.target.value)}
                                                className="w-full rounded border px-2 py-1.5 text-center"
                                                placeholder="4.8"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">Materiales (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={cacMateriales}
                                                onChange={(e) => setCacMateriales(e.target.value)}
                                                className="w-full rounded border px-2 py-1.5 text-center"
                                                placeholder="3.2"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* INDEC Form */}
                            {modalMode === 'indec' && (
                                <div className="space-y-3 rounded-lg border border-purple-200 bg-purple-50 p-4">
                                    <h3 className="text-sm font-semibold text-purple-800">
                                        Índice de Precios al Consumidor (INDEC)
                                    </h3>
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">IPC General (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={indecIpc}
                                                onChange={(e) => setIndecIpc(e.target.value)}
                                                className="w-full rounded border px-2 py-1.5 text-center"
                                                placeholder="5.1"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs text-gray-600 mb-1">IPC Vivienda (%)</label>
                                            <input
                                                type="number"
                                                step="0.1"
                                                value={indecVivienda}
                                                onChange={(e) => setIndecVivienda(e.target.value)}
                                                className="w-full rounded border px-2 py-1.5 text-center"
                                                placeholder="4.5"
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notify Organizations */}
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formNotify}
                                    onChange={(e) => setFormNotify(e.target.checked)}
                                    className="rounded border-gray-300"
                                />
                                <Bell className="h-4 w-4 text-gray-500" />
                                <span className="text-sm text-gray-700">
                                    Notificar a todas las organizaciones
                                </span>
                            </label>
                        </div>

                        <div className="flex items-center justify-end gap-3 pt-4 mt-4 border-t">
                            <button
                                type="button"
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={modalMode === 'cac' ? submitCac : submitIndec}
                                disabled={isSubmitting}
                                className="flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2 text-white hover:bg-primary-700 disabled:opacity-50"
                            >
                                {isSubmitting ? (
                                    <RefreshCw className="h-4 w-4 animate-spin" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {isSubmitting ? 'Guardando...' : 'Guardar Índices'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
