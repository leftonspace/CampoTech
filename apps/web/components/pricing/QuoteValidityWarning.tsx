'use client';

/**
 * Quote Validity Warning Component
 * 
 * Phase 6 - Dynamic Pricing (Jan 2026)
 * 
 * Displays a warning when viewing quotes that may have outdated prices
 * due to inflation or exchange rate changes since the quote was created.
 */

import { useMemo } from 'react';
import {
    AlertTriangle,
    TrendingUp,
    RefreshCw,
    Clock,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface QuoteValidityWarningProps {
    /** When the quote was created */
    quoteDate: Date | string;
    /** When prices were last adjusted (from org settings) */
    lastPriceAdjustment?: Date | string | null;
    /** Current inflation rate % (latest index) */
    currentInflationRate?: number | null;
    /** Quote total in ARS */
    quoteTotal?: number;
    /** Days after which to show warning */
    warningThresholdDays?: number;
    /** Callback to recalculate prices */
    onRecalculate?: () => void;
    /** Show compact version */
    compact?: boolean;
    /** Additional classes */
    className?: string;
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

function daysBetween(date1: Date, date2: Date): number {
    const diff = Math.abs(date2.getTime() - date1.getTime());
    return Math.floor(diff / (1000 * 60 * 60 * 24));
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(value);
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export function QuoteValidityWarning({
    quoteDate,
    lastPriceAdjustment,
    currentInflationRate,
    quoteTotal,
    warningThresholdDays = 30,
    onRecalculate,
    compact = false,
    className,
}: QuoteValidityWarningProps) {
    const analysis = useMemo(() => {
        const quoteDateObj = typeof quoteDate === 'string' ? new Date(quoteDate) : quoteDate;
        const now = new Date();
        const daysSinceQuote = daysBetween(quoteDateObj, now);

        // Check if quote is old enough to warrant a warning
        if (daysSinceQuote < warningThresholdDays) {
            return null;
        }

        // Calculate potential price drift
        let estimatedDrift = 0;
        const monthsSinceQuote = daysSinceQuote / 30;

        if (currentInflationRate) {
            // Estimate cumulative inflation since quote
            estimatedDrift = (currentInflationRate / 100) * monthsSinceQuote * 0.8; // 0.8 factor for partial months
        }

        // Check if prices were adjusted after quote
        const adjustmentAfterQuote = lastPriceAdjustment
            ? new Date(lastPriceAdjustment) > quoteDateObj
            : false;

        // Determine severity
        let severity: 'info' | 'warning' | 'critical';
        if (adjustmentAfterQuote) {
            severity = 'critical'; // Prices definitely changed since quote
        } else if (daysSinceQuote > 60 || estimatedDrift > 0.1) {
            severity = 'warning'; // Likely outdated
        } else {
            severity = 'info'; // Just informational
        }

        return {
            daysSinceQuote,
            monthsSinceQuote: Math.floor(monthsSinceQuote),
            estimatedDrift,
            adjustmentAfterQuote,
            severity,
            potentialDifference: quoteTotal ? quoteTotal * estimatedDrift : null,
        };
    }, [quoteDate, lastPriceAdjustment, currentInflationRate, quoteTotal, warningThresholdDays]);

    // Don't render if no warning needed
    if (!analysis) return null;

    const severityStyles = {
        info: {
            bg: 'bg-blue-50 border-blue-200',
            icon: 'text-blue-600',
            text: 'text-blue-700',
            title: 'text-blue-900',
        },
        warning: {
            bg: 'bg-amber-50 border-amber-200',
            icon: 'text-amber-600',
            text: 'text-amber-700',
            title: 'text-amber-900',
        },
        critical: {
            bg: 'bg-red-50 border-red-200',
            icon: 'text-red-600',
            text: 'text-red-700',
            title: 'text-red-900',
        },
    };

    const styles = severityStyles[analysis.severity];
    const Icon = analysis.adjustmentAfterQuote ? AlertTriangle : TrendingUp;

    if (compact) {
        return (
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${styles.bg} border ${className || ''}`}>
                <Icon className={`h-4 w-4 ${styles.icon}`} />
                <span className={styles.text}>
                    {analysis.adjustmentAfterQuote
                        ? 'Los precios se actualizaron desde este presupuesto'
                        : `Presupuesto de hace ${analysis.daysSinceQuote} días`}
                </span>
                {onRecalculate && (
                    <button
                        onClick={onRecalculate}
                        className="ml-auto text-xs font-medium underline"
                    >
                        Recalcular
                    </button>
                )}
            </div>
        );
    }

    return (
        <div className={`rounded-lg border p-4 ${styles.bg} ${className || ''}`}>
            <div className="flex items-start gap-3">
                <Icon className={`h-5 w-5 mt-0.5 ${styles.icon}`} />
                <div className="flex-1">
                    <h4 className={`font-semibold ${styles.title}`}>
                        {analysis.adjustmentAfterQuote
                            ? 'Precios Actualizados'
                            : 'Precios Potencialmente Desactualizados'}
                    </h4>
                    <p className={`text-sm mt-1 ${styles.text}`}>
                        {analysis.adjustmentAfterQuote ? (
                            <>
                                Los precios de tu lista se actualizaron desde que se creó este presupuesto.
                                Los montos podrían no coincidir con los valores actuales.
                            </>
                        ) : (
                            <>
                                Este presupuesto fue creado hace <strong>{analysis.daysSinceQuote} días</strong>.
                                {analysis.estimatedDrift > 0 && (
                                    <> Con la inflación actual, los precios podrían haber aumentado aproximadamente un{' '}
                                        <strong>{(analysis.estimatedDrift * 100).toFixed(1)}%</strong>.</>
                                )}
                            </>
                        )}
                    </p>

                    {analysis.potentialDifference && analysis.potentialDifference > 0 && (
                        <p className={`text-sm mt-2 ${styles.text}`}>
                            <strong>Diferencia estimada:</strong> +{formatCurrency(analysis.potentialDifference)}
                        </p>
                    )}

                    <div className="flex items-center gap-2 mt-3">
                        <span className={`flex items-center gap-1 text-xs ${styles.text}`}>
                            <Clock className="h-3 w-3" />
                            {analysis.monthsSinceQuote > 0
                                ? `+${analysis.monthsSinceQuote} mes${analysis.monthsSinceQuote > 1 ? 'es' : ''}`
                                : `${analysis.daysSinceQuote} días`}
                        </span>

                        {onRecalculate && (
                            <button
                                onClick={onRecalculate}
                                className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium ${analysis.severity === 'critical'
                                        ? 'bg-red-600 text-white hover:bg-red-700'
                                        : analysis.severity === 'warning'
                                            ? 'bg-amber-600 text-white hover:bg-amber-700'
                                            : 'bg-blue-600 text-white hover:bg-blue-700'
                                    } transition-colors`}
                            >
                                <RefreshCw className="h-3 w-3" />
                                Recalcular con precios actuales
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
