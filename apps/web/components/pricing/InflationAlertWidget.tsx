'use client';

/**
 * Inflation Alert Widget
 * 
 * Phase 6 - Dynamic Pricing (Jan 2026)
 * 
 * Dashboard widget that shows when new inflation indices are available
 * and prompts the organization owner to apply adjustments.
 */

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
    TrendingUp,
    ArrowRight,
    Calendar,
    X,
    Bell,
} from 'lucide-react';
import { useState, useEffect } from 'react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface InflationIndex {
    source: string;
    label: string;
    period: string;
    rate: number;
    isRecommended?: boolean;
}

interface InflationSettings {
    preferredSource: string | null;
    lastCheck: string | null;
}

interface InflationAlertData {
    latest: InflationIndex[];
    settings: InflationSettings;
    availableUpdates: number;
}

interface InflationAlertWidgetProps {
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const DISMISSED_KEY = 'inflation-alert-dismissed';

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function getDismissedPeriod(): string | null {
    try {
        return localStorage.getItem(DISMISSED_KEY);
    } catch {
        return null;
    }
}

function dismissForPeriod(period: string): void {
    try {
        localStorage.setItem(DISMISSED_KEY, period);
    } catch {
        // Ignore storage errors
    }
}

function formatPeriod(period: string): string {
    const [year, month] = period.split('-');
    const months = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
        'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return `${months[parseInt(month) - 1]} ${year}`;
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function InflationAlertWidget({ className }: InflationAlertWidgetProps) {
    const [dismissedPeriod, setDismissedPeriod] = useState<string | null>(null);

    // Load dismissed state on mount
    useEffect(() => {
        setDismissedPeriod(getDismissedPeriod());
    }, []);

    // Fetch inflation data
    const { data, isLoading, error } = useQuery({
        queryKey: ['inflation-alert'],
        queryFn: async () => {
            const res = await fetch('/api/inflation');
            const json = await res.json();
            if (!json.success) throw new Error(json.error);
            return json.data as InflationAlertData;
        },
        staleTime: 5 * 60 * 1000, // 5 minutes
    });

    // Don't render if loading, error, or no new updates
    if (isLoading || error) return null;
    if (!data || data.availableUpdates === 0) return null;

    // Get the recommended or first index
    const latestIndex = data.latest.find(i => i.isRecommended) || data.latest[0];
    if (!latestIndex) return null;

    // Check if already dismissed for this period
    if (dismissedPeriod === latestIndex.period) return null;

    // Calculate days since last check
    const lastCheck = data.settings.lastCheck
        ? Math.floor((Date.now() - new Date(data.settings.lastCheck).getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const handleDismiss = () => {
        dismissForPeriod(latestIndex.period);
        setDismissedPeriod(latestIndex.period);
    };

    return (
        <div className={`rounded-lg border border-green-200 bg-gradient-to-r from-green-50 to-emerald-50 p-4 ${className || ''}`}>
            <div className="flex items-start gap-3">
                {/* Icon */}
                <div className="rounded-lg bg-green-100 p-2">
                    <TrendingUp className="h-5 w-5 text-green-600" />
                </div>

                {/* Content */}
                <div className="flex-1">
                    <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-green-900">
                            Nuevo Índice Disponible
                        </h3>
                        <span className="rounded-full bg-green-200 px-2 py-0.5 text-xs font-medium text-green-800">
                            <Bell className="inline h-3 w-3 mr-1" />
                            Nuevo
                        </span>
                    </div>

                    <p className="text-sm text-green-700 mt-1">
                        El <strong>{latestIndex.label}</strong> de {formatPeriod(latestIndex.period)}
                        {' '}está disponible: <strong className="text-green-800">{latestIndex.rate.toFixed(1)}%</strong>
                    </p>

                    {lastCheck !== null && lastCheck > 30 && (
                        <p className="text-xs text-amber-600 mt-1 flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Hace {lastCheck} días que no ajustás tus precios
                        </p>
                    )}

                    <div className="flex items-center gap-3 mt-3">
                        <Link
                            href="/dashboard/settings/pricebook"
                            className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 transition-colors"
                        >
                            Ajustar Precios
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <button
                            onClick={handleDismiss}
                            className="text-sm text-green-600 hover:text-green-800"
                        >
                            Recordar más tarde
                        </button>
                    </div>
                </div>

                {/* Dismiss button */}
                <button
                    onClick={handleDismiss}
                    className="rounded p-1 text-green-400 hover:text-green-600 hover:bg-green-100"
                    title="Descartar"
                >
                    <X className="h-5 w-5" />
                </button>
            </div>
        </div>
    );
}
