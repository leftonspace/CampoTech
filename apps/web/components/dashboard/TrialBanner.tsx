'use client';

/**
 * Trial Banner Component
 * ======================
 * 
 * Phase 2.5 Task 2.5.1: Trial Expiry UI
 * 
 * Displays a countdown banner for organizations in their trial period.
 * Alerts them when the trial is expiring soon.
 */

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Clock, AlertTriangle, ArrowRight, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface TrialStatus {
    isActive: boolean;
    daysRemaining: number;
    isExpired: boolean;
    isExpiringSoon: boolean;
}

export function TrialBanner() {
    const [status, setStatus] = useState<TrialStatus | null>(null);
    const [isVisible, setIsVisible] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchStatus() {
            try {
                const response = await fetch('/api/access/status');
                const result = await response.json();

                if (result.success && result.data.subscription.status === 'trialing') {
                    setStatus({
                        isActive: result.data.subscription.isActive,
                        daysRemaining: result.data.subscription.trialDaysRemaining,
                        isExpired: result.data.subscription.isTrialExpired,
                        isExpiringSoon: result.data.subscription.trialDaysRemaining <= 7,
                    });
                } else {
                    setIsVisible(false);
                }
            } catch (error) {
                console.error('Failed to fetch trial status:', error);
                setIsVisible(false);
            } finally {
                setLoading(false);
            }
        }

        fetchStatus();
    }, []);

    if (!isVisible || loading || !status || status.isExpired) {
        return null;
    }

    const isCritical = status.daysRemaining <= 3;

    return (
        <div
            className={cn(
                "relative w-full py-2 px-4 flex items-center justify-between transition-colors",
                status.isExpiringSoon
                    ? (isCritical ? "bg-red-600 text-white" : "bg-amber-500 text-white")
                    : "bg-primary-600 text-white"
            )}
        >
            <div className="flex-1 flex items-center justify-center gap-3">
                {status.isExpiringSoon ? (
                    <AlertTriangle className="h-4 w-4 animate-pulse" />
                ) : (
                    <Clock className="h-4 w-4" />
                )}

                <p className="text-sm font-medium">
                    {status.isExpiringSoon
                        ? `Tu prueba gratuita termina en ${status.daysRemaining} ${status.daysRemaining === 1 ? 'día' : 'días'}.`
                        : `Estás en el período de prueba. Te quedan ${status.daysRemaining} días de acceso completo.`
                    }
                </p>

                <Link
                    href="/dashboard/settings/billing"
                    className="ml-2 inline-flex items-center gap-1 text-sm font-bold underline hover:no-underline"
                >
                    Elegir un plan
                    <ArrowRight className="h-3 w-3" />
                </Link>
            </div>

            <button
                onClick={() => setIsVisible(false)}
                className="p-1 hover:bg-black/10 rounded-full transition-colors"
                aria-label="Cerrar banner"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

export default TrialBanner;
