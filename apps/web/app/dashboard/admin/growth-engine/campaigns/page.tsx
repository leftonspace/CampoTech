/**
 * Campaigns Page
 * ==============
 * 
 * Phase 4.4: Growth Engine
 * /dashboard/admin/growth-engine/campaigns
 * 
 * Manage outreach campaigns for unclaimed profiles.
 */

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft,
    Send,
    Plus,
    Clock,
    CheckCircle2,
    AlertCircle,
    Pause,
    Play,
    MoreHorizontal,
    Users
} from 'lucide-react';

// Platform admin organization IDs
const PLATFORM_ADMIN_ORGS = ['test-org-001'];

async function checkPlatformAdmin(organizationId: string): Promise<boolean> {
    if (PLATFORM_ADMIN_ORGS.includes(organizationId)) {
        return true;
    }
    const org = await prisma.organization.findUnique({
        where: { id: organizationId },
        select: { settings: true },
    });
    const settings = org?.settings as Record<string, unknown> | null;
    return settings?.isPlatformAdmin === true;
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

const sourceLabels: Record<string, string> = {
    ERSEP: 'ERSEP (Córdoba)',
    CACAAV: 'CACAAV (Nacional)',
    GASNOR: 'Gasnor (Norte)',
    GASNEA: 'GasNEA (NEA)',
    ENARGAS: 'ENARGAS (Nacional)',
    MANUAL: 'Manual',
};

const statusConfig: Record<string, { label: string; color: string; icon: typeof Clock }> = {
    draft: { label: 'Borrador', color: 'bg-slate-100 text-slate-600', icon: Clock },
    ready: { label: 'Listo', color: 'bg-amber-100 text-amber-700', icon: CheckCircle2 },
    approved: { label: 'Aprobado', color: 'bg-blue-100 text-blue-700', icon: CheckCircle2 },
    launching: { label: 'Enviando', color: 'bg-purple-100 text-purple-700', icon: Play },
    paused: { label: 'Pausado', color: 'bg-orange-100 text-orange-700', icon: Pause },
    completed: { label: 'Completado', color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
    cancelled: { label: 'Cancelado', color: 'bg-red-100 text-red-700', icon: AlertCircle },
};

export default async function CampaignsPage() {
    const session = await getSession();
    if (!session) {
        redirect('/login');
    }

    const isPlatformAdmin = await checkPlatformAdmin(session.organizationId);
    if (!isPlatformAdmin) {
        redirect('/dashboard/admin/growth-engine');
    }

    const campaigns = await getCampaigns();

    return (
        <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <Link
                        href="/dashboard/admin/growth-engine"
                        className="inline-flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 transition-colors"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Volver al Growth Engine
                    </Link>
                    <h1 className="text-2xl font-bold text-gray-900">Campañas de Outreach</h1>
                    <p className="text-gray-500 mt-1">
                        Gestión de campañas de mensajes para perfiles no reclamados
                    </p>
                </div>
                <button
                    className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg flex items-center gap-2 transition-colors"
                    disabled
                    title="Próximamente"
                >
                    <Plus className="w-4 h-4" />
                    Nueva Campaña
                </button>
            </div>

            {/* Launch Gate Warning */}
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-4">
                <AlertCircle className="w-6 h-6 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                    <h3 className="font-semibold text-amber-800">Funcionalidad en Desarrollo</h3>
                    <p className="text-sm text-amber-700 mt-1">
                        La creación y envío de campañas estará disponible próximamente.
                        Mientras tanto, podés importar perfiles y prepararlos para el lanzamiento.
                    </p>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-4 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <Send className="w-4 h-4" />
                        Total Campañas
                    </div>
                    <p className="text-3xl font-bold text-gray-900">{campaigns.length}</p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <Play className="w-4 h-4" />
                        En Progreso
                    </div>
                    <p className="text-3xl font-bold text-purple-600">
                        {campaigns.filter(c => c.status === 'launching').length}
                    </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <Users className="w-4 h-4" />
                        Enviados Total
                    </div>
                    <p className="text-3xl font-bold text-blue-600">
                        {campaigns.reduce((sum, c) => sum + c.sentCount, 0).toLocaleString()}
                    </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center gap-2 text-gray-500 text-sm mb-2">
                        <CheckCircle2 className="w-4 h-4" />
                        Reclamados
                    </div>
                    <p className="text-3xl font-bold text-emerald-600">
                        {campaigns.reduce((sum, c) => sum + c.claimedCount, 0).toLocaleString()}
                    </p>
                </div>
            </div>

            {/* Campaigns Table */}
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                <div className="p-4 border-b border-gray-200">
                    <h2 className="font-semibold text-gray-900">Todas las Campañas</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Campaña</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Estado</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Canal</th>
                                <th className="text-left px-4 py-3 font-medium text-gray-600">Fuente</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Objetivo</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Enviados</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Reclamados</th>
                                <th className="text-right px-4 py-3 font-medium text-gray-600">Conv. %</th>
                                <th className="text-center px-4 py-3 font-medium text-gray-600">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {campaigns.map((campaign) => {
                                const StatusIcon = statusConfig[campaign.status]?.icon || Clock;
                                const convRate = campaign.sentCount > 0
                                    ? ((campaign.claimedCount / campaign.sentCount) * 100).toFixed(1)
                                    : '0.0';

                                return (
                                    <tr key={campaign.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-3">
                                            <p className="font-medium text-gray-900">{campaign.name}</p>
                                            <p className="text-xs text-gray-500">
                                                {new Date(campaign.createdAt).toLocaleDateString('es-AR')}
                                            </p>
                                        </td>
                                        <td className="px-4 py-3">
                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${statusConfig[campaign.status]?.color || 'bg-gray-100 text-gray-600'}`}>
                                                <StatusIcon className="w-3 h-3" />
                                                {statusConfig[campaign.status]?.label || campaign.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 capitalize text-gray-700">
                                            {campaign.channel}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {campaign.source ? sourceLabels[campaign.source] || campaign.source : 'Todas'}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-700">
                                            {campaign.targetCount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-700">
                                            {campaign.sentCount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-emerald-600 font-medium">
                                            {campaign.claimedCount.toLocaleString()}
                                        </td>
                                        <td className="px-4 py-3 text-right text-gray-700">
                                            {convRate}%
                                        </td>
                                        <td className="px-4 py-3 text-center">
                                            <button className="p-1 text-gray-400 hover:text-gray-600 rounded" disabled>
                                                <MoreHorizontal className="w-5 h-5" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {campaigns.length === 0 && (
                                <tr>
                                    <td colSpan={9} className="px-4 py-12 text-center text-gray-500">
                                        <Send className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                        <p className="font-medium">No hay campañas creadas</p>
                                        <p className="text-sm mt-1">Las campañas estarán disponibles próximamente</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
