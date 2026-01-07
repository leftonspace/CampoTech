/**
 * Growth Engine Admin Dashboard
 * =============================
 * 
 * Phase 4.4: Growth Engine
 * /dashboard/admin/growth-engine
 * 
 * Admin dashboard for managing unclaimed profiles and outreach campaigns.
 * Shows import statistics, profile browser, and campaign management.
 * 
 * ACCESS: Platform admin only (test-org-001 or super admin flag)
 */

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    Users,
    Phone,
    Mail,
    CheckCircle2,
    AlertTriangle,
    TrendingUp,
    Database,
    Send,
    Settings,
    ShieldAlert
} from 'lucide-react';

// Platform admin organization IDs - only these can access Growth Engine
const PLATFORM_ADMIN_ORGS = ['test-org-001'];

async function checkPlatformAdmin(organizationId: string): Promise<boolean> {
    // Check if user's org is a platform admin
    if (PLATFORM_ADMIN_ORGS.includes(organizationId)) {
        return true;
    }

    // Check if org has platform admin flag
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
    });

    const settings = org?.settings as Record<string, unknown> | null;
    return settings?.isPlatformAdmin === true;
}

async function getStats() {
    const [
        totalProfiles,
        withPhone,
        withEmail,
        claimed,
        bySource
    ] = await Promise.all([
        prisma.unclaimedProfile.count(),
        prisma.unclaimedProfile.count({ where: { phone: { not: null } } }),
        prisma.unclaimedProfile.count({ where: { email: { not: null } } }),
        prisma.unclaimedProfile.count({ where: { claimedAt: { not: null } } }),
        prisma.unclaimedProfile.groupBy({
            by: ['source'],
            _count: { id: true },
            orderBy: { _count: { id: 'desc' } }
        })
    ]);

    // Get per-source stats
    const sourceStats = await Promise.all(
        bySource.map(async (s: { source: string; _count: { id: number } }) => {
            const [withPhoneCount, withEmailCount, claimedCount] = await Promise.all([
                prisma.unclaimedProfile.count({ where: { source: s.source as never, phone: { not: null } } }),
                prisma.unclaimedProfile.count({ where: { source: s.source as never, email: { not: null } } }),
                prisma.unclaimedProfile.count({ where: { source: s.source as never, claimedAt: { not: null } } }),
            ]);
            return {
                source: s.source,
                total: s._count.id,
                withPhone: withPhoneCount,
                withEmail: withEmailCount,
                claimed: claimedCount,
                conversionRate: s._count.id > 0 ? ((claimedCount / s._count.id) * 100).toFixed(1) : '0',
            };
        })
    );


    return {
        totalProfiles,
        withPhone,
        withEmail,
        claimed,
        conversionRate: totalProfiles > 0 ? ((claimed / totalProfiles) * 100).toFixed(1) : '0',
        sourceStats,
    };
}

interface Campaign {
    id: string;
    name: string;
    status: string;
    channel: string;
    source: string | null;
    targetCount: number;
    sentCount: number;
    claimedCount: number;
    createdAt: Date;
    launchedAt: Date | null;
}

async function getCampaigns(): Promise<Campaign[]> {
    return prisma.outreachCampaign.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            name: true,
            status: true,
            channel: true,
            source: true,
            targetCount: true,
            sentCount: true,
            claimedCount: true,
            createdAt: true,
            launchedAt: true,
        }
    }) as unknown as Promise<Campaign[]>;
}


export default async function GrowthEngineDashboardPage() {
    // Check platform admin access
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    const isPlatformAdmin = await checkPlatformAdmin(session.organizationId);
    if (!isPlatformAdmin) {
        return (
            <div className="p-6 max-w-2xl mx-auto">
                <div className="bg-red-50 border border-red-200 rounded-xl p-8 text-center">
                    <ShieldAlert className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <h1 className="text-xl font-bold text-red-800">Acceso Restringido</h1>
                    <p className="text-red-600 mt-2">
                        El Growth Engine es una herramienta de administración de plataforma.
                        Solo los administradores de CampoTech pueden acceder a esta sección.
                    </p>
                    <Link
                        href="/dashboard"
                        className="inline-block mt-6 px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                    >
                        Volver al Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    const stats = await getStats();
    const campaigns = await getCampaigns();

    const sourceLabels: Record<string, string> = {
        ERSEP: 'ERSEP (Córdoba)',
        CACAAV: 'CACAAV (Nacional)',
        GASNOR: 'Gasnor (Norte)',
        GASNEA: 'GasNEA (NEA)',
        ENARGAS: 'ENARGAS (Nacional)',
        MANUAL: 'Manual Import',
    };

    const statusColors: Record<string, string> = {
        draft: 'bg-slate-100 text-slate-600',
        ready: 'bg-amber-100 text-amber-700',
        approved: 'bg-blue-100 text-blue-700',
        launching: 'bg-purple-100 text-purple-700',
        paused: 'bg-orange-100 text-orange-700',
        completed: 'bg-emerald-100 text-emerald-700',
        cancelled: 'bg-red-100 text-red-700',
    };

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold">Growth Engine</h1>
                    <p className="text-gray-400 mt-1">
                        Gestión de perfiles no reclamados y campañas de outreach
                    </p>
                </div>
                <div className="flex gap-3">
                    <Link
                        href="/dashboard/admin/growth-engine/scrapers"
                        className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Database className="w-4 h-4" />
                        Scrapers
                    </Link>
                    <Link
                        href="/dashboard/admin/growth-engine/profiles"
                        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Database className="w-4 h-4" />
                        Ver Perfiles
                    </Link>
                    <Link
                        href="/dashboard/admin/growth-engine/campaigns"
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    >
                        <Send className="w-4 h-4" />
                        Campañas
                    </Link>
                </div>
            </div>


            {/* Launch Gate Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
                <AlertTriangle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-amber-800">Outbound Messaging Pausado</h3>
                    <p className="text-sm text-amber-700 mt-1">
                        El envío de mensajes está bloqueado hasta que se complete el checklist de lanzamiento.
                        Los perfiles pueden ser visualizados y las campañas configuradas, pero no se enviarán mensajes.
                    </p>
                    <Link
                        href="/dashboard/admin/growth-engine/launch"
                        className="inline-flex items-center gap-1 mt-2 text-sm text-amber-600 hover:text-amber-800 font-medium"
                    >
                        <Settings className="w-4 h-4" />
                        Ir al Checklist de Lanzamiento
                    </Link>
                </div>
            </div>

            {/* Main Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <Users className="w-4 h-4" />
                        Total Perfiles
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalProfiles.toLocaleString()}</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <Phone className="w-4 h-4" />
                        Con Teléfono
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">{stats.withPhone.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {stats.totalProfiles > 0 ? ((stats.withPhone / stats.totalProfiles) * 100).toFixed(0) : 0}% del total
                    </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <Mail className="w-4 h-4" />
                        Con Email
                    </div>
                    <p className="text-3xl font-bold text-blue-600">{stats.withEmail.toLocaleString()}</p>
                    <p className="text-xs text-gray-500 mt-1">
                        {stats.totalProfiles > 0 ? ((stats.withEmail / stats.totalProfiles) * 100).toFixed(0) : 0}% del total
                    </p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Reclamados
                    </div>
                    <p className="text-3xl font-bold text-purple-600">{stats.claimed.toLocaleString()}</p>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <TrendingUp className="w-4 h-4" />
                        Conversión
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{stats.conversionRate}%</p>
                </div>
            </div>

            {/* Source Breakdown */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Perfiles por Fuente</h2>

                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Fuente</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Con Tel.</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Con Email</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Reclamados</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Conv. %</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {stats.sourceStats.map((source) => (
                                <tr key={source.source} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 font-medium text-gray-900">
                                        {sourceLabels[source.source] || source.source}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-700">{source.total.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-emerald-600">
                                        {source.withPhone.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-blue-600">
                                        {source.withEmail.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-purple-600">
                                        {source.claimed.toLocaleString()}
                                    </td>
                                    <td className="px-4 py-3 text-right text-gray-700">{source.conversionRate}%</td>
                                </tr>
                            ))}
                            {stats.sourceStats.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        No hay perfiles importados aún
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* Recent Campaigns */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200 flex items-center justify-between">
                    <h2 className="font-semibold text-gray-900">Campañas Recientes</h2>
                    <Link
                        href="/dashboard/admin/growth-engine/campaigns"
                        className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                        Ver todas →
                    </Link>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Campaña</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Canal</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Objetivo</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Enviados</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Reclamados</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {campaigns.map((campaign) => (
                                <tr key={campaign.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3">
                                        <Link
                                            href={`/dashboard/admin/growth-engine/campaigns/${campaign.id}`}
                                            className="font-medium text-gray-900 hover:text-emerald-600"
                                        >
                                            {campaign.name}
                                        </Link>
                                        <p className="text-xs text-gray-500 mt-0.5">
                                            {campaign.source ? sourceLabels[campaign.source] || campaign.source : 'Todas las fuentes'}
                                        </p>
                                    </td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-1 rounded-full text-xs ${statusColors[campaign.status] || 'bg-gray-100 text-gray-600'}`}>
                                            {campaign.status}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 capitalize text-gray-700">{campaign.channel}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{campaign.targetCount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-gray-700">{campaign.sentCount.toLocaleString()}</td>
                                    <td className="px-4 py-3 text-right text-emerald-600">
                                        {campaign.claimedCount.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {campaigns.length === 0 && (
                                <tr>
                                    <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                                        No hay campañas creadas aún
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>


            {/* Conversion Metrics by Source */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Conversión por Fuente</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Porcentaje de perfiles reclamados vs total por cada fuente de datos
                    </p>
                </div>
                <div className="p-6 space-y-4">
                    {stats.sourceStats.length > 0 ? (
                        stats.sourceStats.map((source) => {
                            const conversionPct = parseFloat(source.conversionRate);
                            const phonePct = source.total > 0 ? (source.withPhone / source.total) * 100 : 0;
                            const emailPct = source.total > 0 ? (source.withEmail / source.total) * 100 : 0;

                            return (
                                <div key={source.source} className="space-y-2">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="font-medium text-gray-900">
                                            {sourceLabels[source.source] || source.source}
                                        </span>
                                        <span className="text-gray-500">
                                            {source.claimed.toLocaleString()} / {source.total.toLocaleString()} perfiles
                                        </span>
                                    </div>

                                    {/* Stacked Progress Bar */}
                                    <div className="w-full h-6 bg-gray-100 rounded-full overflow-hidden flex">
                                        {/* Claimed Segment */}
                                        <div
                                            className="h-full bg-gradient-to-r from-emerald-500 to-emerald-600 flex items-center justify-end px-2"
                                            style={{ width: `${Math.max(conversionPct, 0)}%` }}
                                        >
                                            {conversionPct >= 10 && (
                                                <span className="text-xs font-medium text-white">
                                                    {conversionPct}%
                                                </span>
                                            )}
                                        </div>
                                        {/* Remaining */}
                                        <div className="h-full flex-1 bg-gray-200" />
                                    </div>

                                    {/* Data Quality Indicators */}
                                    <div className="flex gap-4 text-xs text-gray-600">
                                        <div className="flex items-center gap-1">
                                            <Phone className="w-3 h-3 text-emerald-500" />
                                            <span>{phonePct.toFixed(0)}% con teléfono</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <Mail className="w-3 h-3 text-blue-500" />
                                            <span>{emailPct.toFixed(0)}% con email</span>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <CheckCircle2 className="w-3 h-3 text-purple-500" />
                                            <span>{source.conversionRate}% reclamados</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    ) : (
                        <div className="text-center py-8 text-gray-500">
                            <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>No hay datos de conversión disponibles</p>
                            <p className="text-sm mt-1">Importá perfiles para ver las métricas</p>
                        </div>
                    )}
                </div>
            </div>


            {/* PDF Import Section */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Importar desde PDF</h2>
                    <p className="text-sm text-gray-500 mt-1">
                        Importá listados de matriculados de Gasnor o GasNEA desde archivos PDF
                    </p>
                </div>
                <div className="p-6">
                    <div className="grid md:grid-cols-2 gap-4">
                        {/* Gasnor Import Card */}
                        <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center">
                                    <Database className="w-5 h-5 text-orange-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900">Gasnor</h3>
                                    <p className="text-xs text-gray-500">Salta, Jujuy, Tucumán</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                Importar listado de gasistas matriculados del Norte argentino.
                            </p>
                            <Link
                                href="/dashboard/admin/growth-engine/import?source=GASNOR"
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm transition-colors"
                            >
                                <Database className="w-4 h-4" />
                                Importar PDF de Gasnor
                            </Link>
                        </div>

                        {/* GasNEA Import Card */}
                        <div className="bg-cyan-50 border border-cyan-200 rounded-lg p-4">
                            <div className="flex items-center gap-3 mb-3">
                                <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
                                    <Database className="w-5 h-5 text-cyan-600" />
                                </div>
                                <div>
                                    <h3 className="font-medium text-gray-900">GasNEA</h3>
                                    <p className="text-xs text-gray-500">Corrientes, Chaco, Formosa</p>
                                </div>
                            </div>
                            <p className="text-sm text-gray-600 mb-4">
                                Importar listado de gasistas matriculados del NEA argentino.
                            </p>
                            <Link
                                href="/dashboard/admin/growth-engine/import?source=GASNEA"
                                className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-cyan-500 hover:bg-cyan-600 text-white rounded-lg text-sm transition-colors"
                            >
                                <Database className="w-4 h-4" />
                                Importar PDF de GasNEA
                            </Link>
                        </div>
                    </div>
                </div>
            </div>

        </div>
    );
}
