'use client';

/**
 * Phase 4.6: Email Outreach Dashboard
 * =====================================
 * 
 * Admin dashboard for managing email outreach campaigns.
 * Shows stats, campaign list, and send controls.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Mail,
    Send,
    MailCheck,
    MousePointerClick,
    UserCheck,
    AlertCircle,
    Lock,
    RefreshCw,
    Play,
    Eye,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface EmailStats {
    total: number;
    sent: number;
    delivered: number;
    opened: number;
    clicked: number;
    bounced: number;
    unsubscribed: number;
    bySource: Record<string, {
        total: number;
        sent: number;
        claimed: number;
    }>;
}

interface Campaign {
    id: string;
    name: string;
    channel: string;
    status: string;
    source: string | null;
    targetCount: number;
    sentCount: number;
    openedCount: number;
    clickedCount: number;
    claimedCount: number;
    createdAt: string;
}

interface LaunchStatus {
    isLaunched: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function EmailOutreachDashboard() {
    const [stats, setStats] = useState<EmailStats | null>(null);
    const [campaigns, setCampaigns] = useState<Campaign[]>([]);
    const [launchStatus, setLaunchStatus] = useState<LaunchStatus | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [statsRes, campaignsRes, launchRes] = await Promise.all([
                fetch('/api/admin/outreach/email/stats'),
                fetch('/api/admin/campaigns?channel=email'),
                fetch('/api/admin/growth-engine/launch'),
            ]);

            const statsData = await statsRes.json();
            const campaignsData = await campaignsRes.json();
            const launchData = await launchRes.json();

            if (statsData.stats) setStats(statsData.stats);
            if (campaignsData.campaigns) setCampaigns(campaignsData.campaigns.filter((c: Campaign) => c.channel === 'email'));
            setLaunchStatus(launchData);
        } catch {
            setError('Error al cargar datos');
        } finally {
            setLoading(false);
        }
    };

    const sendCampaign = async (campaignId: string) => {
        if (sending) return;

        setSending(campaignId);
        setError(null);

        try {
            const res = await fetch('/api/admin/outreach/email/send', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ campaignId, limit: 100 }), // Start with 100 for testing
            });

            const data = await res.json();

            if (data.success) {
                await fetchData();
            } else {
                setError(data.error || 'Error al enviar');
            }
        } catch {
            setError('Error de conexión');
        } finally {
            setSending(null);
        }
    };

    // Format percentage
    const formatRate = (numerator: number, denominator: number): string => {
        if (denominator === 0) return '0%';
        return ((numerator / denominator) * 100).toFixed(1) + '%';
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard/admin/growth-engine"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-2 text-sm"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Growth Engine
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-3">
                        <Mail className="w-7 h-7 text-emerald-600" />
                        Email Outreach Dashboard
                    </h1>
                </div>
                <button
                    onClick={fetchData}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    Actualizar
                </button>
            </div>

            {/* Launch Gate Warning */}
            {launchStatus && !launchStatus.isLaunched && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
                    <Lock className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                        <h3 className="font-semibold text-amber-800">⚠️ Outreach Bloqueado</h3>
                        <p className="text-amber-700 text-sm mt-1">
                            El envío de emails está deshabilitado.
                            <Link href="/dashboard/admin/growth-engine/launch" className="underline ml-1">
                                Completá el checklist de lanzamiento
                            </Link>
                        </p>
                    </div>
                </div>
            )}

            {error && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-center gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <span className="text-red-700">{error}</span>
                </div>
            )}

            {loading ? (
                <div className="text-center py-12 text-gray-500">Cargando...</div>
            ) : (
                <>
                    {/* Stats Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                        <StatCard
                            label="Con Email"
                            value={stats?.total || 0}
                            icon={Mail}
                            color="gray"
                        />
                        <StatCard
                            label="Enviados"
                            value={stats?.sent || 0}
                            icon={Send}
                            color="blue"
                        />
                        <StatCard
                            label="Entregados"
                            value={stats?.delivered || 0}
                            icon={MailCheck}
                            color="green"
                            subtext={formatRate(stats?.delivered || 0, stats?.sent || 0)}
                        />
                        <StatCard
                            label="Abiertos"
                            value={stats?.opened || 0}
                            icon={Eye}
                            color="purple"
                            subtext={formatRate(stats?.opened || 0, stats?.delivered || 0)}
                        />
                        <StatCard
                            label="Clicks"
                            value={stats?.clicked || 0}
                            icon={MousePointerClick}
                            color="orange"
                            subtext={formatRate(stats?.clicked || 0, stats?.delivered || 0)}
                        />
                        <StatCard
                            label="Reclamados"
                            value={Object.values(stats?.bySource || {}).reduce((sum, s) => sum + s.claimed, 0)}
                            icon={UserCheck}
                            color="emerald"
                        />
                        <StatCard
                            label="Bounced"
                            value={stats?.bounced || 0}
                            icon={AlertCircle}
                            color="red"
                        />
                    </div>

                    {/* By Source Table */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-200">
                            <h2 className="font-semibold text-gray-900">Perfiles por Fuente</h2>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Enviados</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Reclamados</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Tasa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {Object.entries(stats?.bySource || {}).map(([source, data]) => (
                                        <tr key={source} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 font-medium text-gray-900">{source}</td>
                                            <td className="px-6 py-4 text-right text-gray-600">{data.total.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-gray-600">{data.sent.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-emerald-600 font-medium">{data.claimed.toLocaleString()}</td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                {formatRate(data.claimed, data.sent)}
                                            </td>
                                        </tr>
                                    ))}
                                    {Object.keys(stats?.bySource || {}).length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                                                No hay perfiles con email importados
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Email Campaigns */}
                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                            <h2 className="font-semibold text-gray-900">Campañas de Email</h2>
                            <Link
                                href="/dashboard/admin/growth-engine/campaigns"
                                className="text-sm text-emerald-600 hover:text-emerald-700"
                            >
                                Ver todas →
                            </Link>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Campaña</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Fuente</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Target</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Enviados</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Estado</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {campaigns.map(campaign => (
                                        <tr key={campaign.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{campaign.name}</div>
                                                <div className="text-sm text-gray-500">
                                                    {new Date(campaign.createdAt).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{campaign.source || 'Todos'}</td>
                                            <td className="px-6 py-4 text-right text-gray-600">
                                                {campaign.targetCount.toLocaleString()}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <span className="text-gray-900">{campaign.sentCount.toLocaleString()}</span>
                                                <span className="text-gray-400 text-sm ml-1">
                                                    ({formatRate(campaign.sentCount, campaign.targetCount)})
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                <CampaignStatusBadge status={campaign.status} />
                                            </td>
                                            <td className="px-6 py-4 text-center">
                                                {campaign.status === 'launching' && launchStatus?.isLaunched && (
                                                    <button
                                                        onClick={() => sendCampaign(campaign.id)}
                                                        disabled={sending === campaign.id}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                                    >
                                                        {sending === campaign.id ? (
                                                            <>
                                                                <RefreshCw className="w-4 h-4 animate-spin" />
                                                                Enviando...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Play className="w-4 h-4" />
                                                                Enviar
                                                            </>
                                                        )}
                                                    </button>
                                                )}
                                                {campaign.status === 'draft' && (
                                                    <span className="text-gray-400 text-sm">
                                                        <Lock className="w-4 h-4 inline mr-1" />
                                                        Pendiente
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                    {campaigns.length === 0 && (
                                        <tr>
                                            <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                                                No hay campañas de email.{' '}
                                                <Link href="/dashboard/admin/growth-engine/campaigns" className="text-emerald-600 hover:underline">
                                                    Crear una nueva
                                                </Link>
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Cost Estimate */}
                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                        <h3 className="font-semibold text-blue-800 mb-2">💰 Costo Estimado</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-blue-700">
                            <div>
                                <strong>Resend:</strong> $20/mes = 50k emails
                                <br />
                                <span className="text-blue-600">Costo total para {stats?.total.toLocaleString()} emails: ~$12</span>
                            </div>
                            <div>
                                <strong>AWS SES:</strong> $0.10/1000 emails
                                <br />
                                <span className="text-blue-600">Costo total para {stats?.total.toLocaleString()} emails: ~${((stats?.total || 0) / 1000 * 0.1).toFixed(2)}</span>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function StatCard({
    label,
    value,
    icon: Icon,
    color,
    subtext,
}: {
    label: string;
    value: number;
    icon: React.ComponentType<{ className?: string }>;
    color: string;
    subtext?: string;
}) {
    const colors: Record<string, string> = {
        gray: 'bg-gray-100 text-gray-600',
        blue: 'bg-blue-100 text-blue-600',
        green: 'bg-green-100 text-green-600',
        purple: 'bg-purple-100 text-purple-600',
        orange: 'bg-orange-100 text-orange-600',
        emerald: 'bg-emerald-100 text-emerald-600',
        red: 'bg-red-100 text-red-600',
    };

    return (
        <div className="bg-white border border-gray-200 rounded-xl p-4">
            <div className={`w-10 h-10 rounded-lg ${colors[color]} flex items-center justify-center mb-3`}>
                <Icon className="w-5 h-5" />
            </div>
            <div className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</div>
            <div className="text-sm text-gray-500">{label}</div>
            {subtext && <div className="text-xs text-gray-400 mt-1">{subtext}</div>}
        </div>
    );
}

function CampaignStatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        draft: 'bg-gray-100 text-gray-600',
        ready: 'bg-blue-100 text-blue-600',
        approved: 'bg-green-100 text-green-600',
        launching: 'bg-emerald-100 text-emerald-600',
        paused: 'bg-yellow-100 text-yellow-600',
        completed: 'bg-purple-100 text-purple-600',
        cancelled: 'bg-red-100 text-red-600',
    };

    const labels: Record<string, string> = {
        draft: '🔒 Borrador',
        ready: '✅ Listo',
        approved: '✅ Aprobado',
        launching: '🚀 Enviando',
        paused: '⏸️ Pausado',
        completed: '✓ Completado',
        cancelled: '❌ Cancelado',
    };

    return (
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${styles[status] || styles.draft}`}>
            {labels[status] || status}
        </span>
    );
}
