'use client';

/**
 * Marketplace Analytics Dashboard
 * ==============================
 * 
 * Phase 3.2 Task 3.2.4: Marketplace Performance Dashboard
 * 
 * Displays attribution metrics for WhatsApp clicks from the marketplace.
 * Restricted to OWNER role (checked in layout or via session).
 */

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    MousePointerClick,
    Zap,
    Target,
    Calendar,
    RefreshCw,
    Download,
    TrendingUp,
    MessageCircle
} from 'lucide-react';

import KPICard, { KPIGrid } from '../../../../components/analytics/widgets/KPICard';
import AreaChart from '../../../../components/analytics/charts/AreaChart';
import BarChart from '../../../../components/analytics/charts/BarChart';

interface MarketplaceData {
    kpis: {
        totalClicks: { value: number; change: number };
        totalConversions: { value: number; change: number };
        conversionRate: { value: number; change: number };
    };
    trends: {
        clicksOverTime: { label: string; value: number }[];
        conversionsOverTime: { label: string; value: number }[];
    };
    dailyBreakdown: Array<{
        date: string;
        displayDate: string;
        clicks: number;
        conversions: number;
        rate: string;
    }>;
}

export default function MarketplaceAnalyticsPage() {
    const [days, setDays] = useState(30);

    const { data, isLoading, refetch, isFetching } = useQuery<MarketplaceData>({
        queryKey: ['analytics-marketplace', days],
        queryFn: async () => {
            const response = await fetch(`/api/analytics/marketplace?days=${days}`);
            if (!response.ok) throw new Error('Failed to fetch marketplace analytics');
            return response.json();
        },
    });

    return (
        <div className="p-6 space-y-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageCircle className="text-green-600" />
                        Rendimiento en Marketplace
                    </h1>
                    <p className="text-gray-600">
                        Seguimiento de conversiones desde el Marketplace a WhatsApp
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={days}
                        onChange={(e) => setDays(parseInt(e.target.value))}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-green-500"
                    >
                        <option value={7}>Últimos 7 días</option>
                        <option value={30}>Últimos 30 días</option>
                        <option value={90}>Últimos 90 días</option>
                    </select>

                    <button
                        onClick={() => refetch()}
                        disabled={isFetching}
                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg disabled:opacity-50"
                    >
                        <RefreshCw size={20} className={isFetching ? 'animate-spin' : ''} />
                    </button>

                    <button className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-shadow shadow-sm">
                        <Download size={18} />
                        Exportar
                    </button>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center h-64">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600" />
                </div>
            ) : data ? (
                <>
                    {/* KPIs */}
                    <KPIGrid columns={3}>
                        <KPICard
                            title="Clicks al WhatsApp"
                            value={data.kpis.totalClicks.value}
                            unit="number"
                            trend={data.kpis.totalClicks.change > 0 ? 'up' : 'down'}
                            changePercent={data.kpis.totalClicks.change}
                            icon={<MousePointerClick size={24} />}
                            color="blue"
                        />
                        <KPICard
                            title="Trabajos Generados"
                            value={data.kpis.totalConversions.value}
                            unit="number"
                            trend={data.kpis.totalConversions.change > 0 ? 'up' : 'down'}
                            changePercent={data.kpis.totalConversions.change}
                            icon={<Zap size={24} />}
                            color="green"
                        />
                        <KPICard
                            title="Tasa de Conversión"
                            value={data.kpis.conversionRate.value}
                            unit="percentage"
                            trend={data.kpis.conversionRate.change > 0 ? 'up' : 'down'}
                            changePercent={data.kpis.conversionRate.change}
                            icon={<Target size={24} />}
                            color="purple"
                        />
                    </KPIGrid>

                    {/* Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-500" />
                                Clicks por Día
                            </h3>
                            <AreaChart
                                data={data.trends.clicksOverTime}
                                height={300}
                                color="#3b82f6"
                            />
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                            <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                                <Zap size={20} className="text-green-500" />
                                Conversiones por Día
                            </h3>
                            <BarChart
                                data={data.trends.conversionsOverTime}
                                height={300}
                                color="#16a34a"
                            />
                        </div>
                    </div>

                    {/* Daily Breakdown Table */}
                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                        <div className="px-6 py-4 border-b border-gray-200 bg-gray-50/50">
                            <h3 className="text-lg font-semibold text-gray-900">Desglose Diario</h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left">
                                <thead className="bg-gray-50 text-gray-500 text-sm uppercase font-semibold">
                                    <tr>
                                        <th className="px-6 py-3">Fecha</th>
                                        <th className="px-6 py-3">Clicks</th>
                                        <th className="px-6 py-3">Conversiones</th>
                                        <th className="px-6 py-3">Tasa</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.dailyBreakdown.map((day) => (
                                        <tr key={day.date} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 font-medium text-gray-900">{day.date}</td>
                                            <td className="px-6 py-4 text-gray-600">{day.clicks}</td>
                                            <td className="px-6 py-4">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${day.conversions > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                                    }`}>
                                                    {day.conversions} trabajos
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-gray-600">{day.rate}%</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                    <MessageCircle className="h-12 w-12 text-gray-300 mb-2" />
                    <p className="text-gray-500">No hay datos de atribución para el período seleccionado.</p>
                </div>
            )}
        </div>
    );
}
