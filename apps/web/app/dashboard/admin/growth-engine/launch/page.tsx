'use client';

/**
 * Phase 4.5: Launch Gate Page
 * ============================
 * 
 * Pre-launch checklist for Growth Engine.
 * Owner must complete all items and approve before any outreach can be sent.
 * 
 * This is the critical safety gate to prevent accidental mass messaging.
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    CheckCircle2,
    Circle,
    AlertTriangle,
    Rocket,
    Shield,
    Building2,
    Wrench,
    MessageSquare,
    Lock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface ChecklistItem {
    key: string;
    label: string;
    category: 'business' | 'technical' | 'confirmation';
    checked: boolean;
    required: boolean;
}

interface LaunchStatus {
    isLaunched: boolean;
    launchedAt: string | null;
    launchedBy: string | null;
    canLaunch: boolean;
    checklistComplete: boolean;
    checklist: ChecklistItem[];
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LaunchGatePage() {
    const router = useRouter();
    const [status, setStatus] = useState<LaunchStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [launching, setLaunching] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch current status
    useEffect(() => {
        fetchStatus();
    }, []);

    const fetchStatus = async () => {
        try {
            const res = await fetch('/api/admin/growth-engine/launch');
            const data = await res.json();
            if (data.success !== false) {
                setStatus(data);
            } else {
                setError(data.error || 'Failed to load status');
            }
        } catch {
            setError('Failed to connect to server');
        } finally {
            setLoading(false);
        }
    };

    const toggleChecklistItem = async (key: string, checked: boolean) => {
        if (status?.isLaunched) return; // Can't modify after launch

        try {
            const res = await fetch('/api/admin/growth-engine/launch', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    checklist: { [key]: checked },
                }),
            });
            const data = await res.json();
            if (data.success !== false) {
                setStatus(data);
            }
        } catch {
            console.error('Failed to update checklist');
        }
    };

    const handleLaunch = async () => {
        if (!status?.canLaunch) return;

        setLaunching(true);
        setError(null);

        try {
            // Build checklist object from status
            const checklist: Record<string, boolean> = {};
            status.checklist.forEach(item => {
                checklist[item.key] = item.checked;
            });

            const res = await fetch('/api/admin/growth-engine/launch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ checklist }),
            });

            const data = await res.json();

            if (data.success) {
                // Redirect to dashboard with success message
                router.push('/dashboard/admin/growth-engine?launched=true');
            } else {
                setError(data.error || 'Launch failed');
            }
        } catch {
            setError('Failed to launch');
        } finally {
            setLaunching(false);
        }
    };

    // Group checklist by category
    const groupedChecklist = {
        business: status?.checklist.filter(i => i.category === 'business') || [],
        technical: status?.checklist.filter(i => i.category === 'technical') || [],
        confirmation: status?.checklist.filter(i => i.category === 'confirmation') || [],
    };

    const categoryIcons = {
        business: Building2,
        technical: Wrench,
        confirmation: MessageSquare,
    };

    const categoryLabels = {
        business: 'Requisitos de Negocio',
        technical: 'Requisitos Técnicos',
        confirmation: 'Confirmación Final',
    };

    // Calculate progress
    const requiredItems = status?.checklist.filter(i => i.required) || [];
    const completedRequired = requiredItems.filter(i => i.checked).length;
    const progressPercent = requiredItems.length > 0
        ? (completedRequired / requiredItems.length) * 100
        : 0;

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            {/* Back Link */}
            <Link
                href="/dashboard/admin/growth-engine"
                className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 transition-colors"
            >
                <ArrowLeft className="w-4 h-4" />
                Volver al Growth Engine
            </Link>

            {/* Header */}
            <div className="text-center">
                <div className="w-16 h-16 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
                    <Rocket className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-gray-900">🚀 Lanzar Growth Engine</h1>
                <p className="text-gray-500 mt-1">
                    Completá todos los items antes de comenzar el envío de mensajes
                </p>
            </div>

            {loading ? (
                <div className="text-center py-12 text-gray-500">Cargando...</div>
            ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                    {error}
                </div>
            ) : status?.isLaunched ? (
                /* Launched State */
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-8 text-center">
                    <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
                    <h2 className="text-xl font-semibold text-emerald-800">Growth Engine Lanzado</h2>
                    <p className="text-emerald-600 mt-2">
                        Lanzado el {new Date(status.launchedAt!).toLocaleString('es-AR')}
                    </p>
                    <Link
                        href="/dashboard/admin/growth-engine"
                        className="inline-flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-lg mt-6 hover:bg-emerald-700 transition-colors"
                    >
                        Ver Dashboard
                    </Link>
                </div>
            ) : (
                <>
                    {/* Warning Banner */}
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-6">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                                <Lock className="w-6 h-6 text-amber-600" />
                            </div>
                            <div className="flex-1">
                                <h2 className="text-lg font-semibold text-amber-800">
                                    Launch Gate Bloqueado
                                </h2>
                                <p className="text-amber-700 mt-1">
                                    El envío de mensajes está deshabilitado hasta que se completen todos los requisitos.
                                    Esto protege a CampoTech de envíos accidentales o no autorizados.
                                </p>

                                {/* Progress Bar */}
                                <div className="mt-4">
                                    <div className="flex items-center justify-between text-sm mb-2">
                                        <span className="text-amber-700">Progreso</span>
                                        <span className="font-medium text-amber-800">
                                            {completedRequired} / {requiredItems.length} requeridos
                                        </span>
                                    </div>
                                    <div className="w-full h-3 bg-amber-200 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-amber-500 rounded-full transition-all duration-300"
                                            style={{ width: `${progressPercent}%` }}
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Checklist Sections */}
                    {(['business', 'technical', 'confirmation'] as const).map(category => {
                        const Icon = categoryIcons[category];
                        const items = groupedChecklist[category];

                        if (items.length === 0) return null;

                        return (
                            <div key={category} className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                                <div className="p-4 border-b border-gray-200 bg-gray-50">
                                    <h2 className="font-semibold text-gray-900 flex items-center gap-2">
                                        <Icon className="w-5 h-5 text-gray-500" />
                                        {categoryLabels[category]}
                                    </h2>
                                </div>
                                <div className="divide-y divide-gray-100">
                                    {items.map(item => (
                                        <div
                                            key={item.key}
                                            onClick={() => toggleChecklistItem(item.key, !item.checked)}
                                            className={`p-4 flex items-center gap-4 cursor-pointer transition-colors ${item.checked
                                                    ? 'bg-emerald-50 hover:bg-emerald-100'
                                                    : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <div className="flex-shrink-0">
                                                {item.checked ? (
                                                    <CheckCircle2 className="w-6 h-6 text-emerald-500" />
                                                ) : (
                                                    <Circle className="w-6 h-6 text-gray-300" />
                                                )}
                                            </div>
                                            <div className="flex-1">
                                                <span className={`${item.checked ? 'text-emerald-800' : 'text-gray-900'
                                                    }`}>
                                                    {item.label}
                                                </span>
                                            </div>
                                            {item.required && (
                                                <span className="px-2 py-1 bg-gray-100 text-gray-500 text-xs rounded">
                                                    Requerido
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        );
                    })}

                    {/* Launch Button */}
                    <div className="bg-gray-50 border border-gray-200 rounded-xl p-8 text-center">
                        <button
                            onClick={handleLaunch}
                            disabled={!status?.canLaunch || launching}
                            className={`inline-flex items-center justify-center gap-3 px-8 py-4 rounded-xl font-semibold text-lg transition-all ${status?.canLaunch
                                    ? 'bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-600 hover:to-emerald-700 shadow-lg hover:shadow-xl'
                                    : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            {launching ? (
                                'Lanzando...'
                            ) : status?.canLaunch ? (
                                <>
                                    <Rocket className="w-5 h-5" />
                                    Lanzar Growth Engine
                                </>
                            ) : (
                                <>
                                    <Lock className="w-5 h-5" />
                                    Completá el checklist
                                </>
                            )}
                        </button>

                        <p className="text-gray-500 text-sm mt-4 flex items-center justify-center gap-2">
                            <Shield className="w-4 h-4" />
                            Esta acción no se puede deshacer. Los mensajes se enviarán según la configuración.
                        </p>
                    </div>

                    {/* Info Box */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h3 className="font-semibold text-blue-800 flex items-center gap-2">
                            <Shield className="w-5 h-5" />
                            ¿Por qué existe el Launch Gate?
                        </h3>
                        <ul className="mt-3 space-y-2 text-sm text-blue-700">
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>Previene envíos accidentales de mensajes masivos</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>Asegura cumplimiento con regulaciones</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>Protege la reputación y entregabilidad</span>
                            </li>
                            <li className="flex items-start gap-2">
                                <CheckCircle2 className="w-4 h-4 mt-0.5 flex-shrink-0" />
                                <span>Requiere aprobación explícita del owner</span>
                            </li>
                        </ul>
                    </div>
                </>
            )}
        </div>
    );
}
