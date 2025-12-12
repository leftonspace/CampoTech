'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  Users,
  Calendar,
  FileText,
  HardDrive,
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface UsageItem {
  current: number;
  limit: number | null;
  percentage: number;
  label: string;
  isMonthly?: boolean;
}

interface UsageResponse {
  tier: {
    id: string;
    name: string;
    priceDisplay: string;
  };
  billingPeriod: {
    daysRemaining: number;
  };
  usage: {
    users: UsageItem;
    customers: UsageItem;
    jobs: UsageItem;
    invoices: UsageItem;
    storage: UsageItem;
  };
  warnings: Array<{
    limitType: string;
    label: string;
    percentage: number;
    message: string;
  }>;
  upgradeRecommendation: {
    recommended: boolean;
    suggestedTierName?: string;
    reason?: string;
  } | null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════════════

async function fetchUsage(): Promise<UsageResponse | null> {
  try {
    const token = localStorage.getItem('accessToken');
    const res = await fetch('/api/usage', {
      headers: { Authorization: token ? `Bearer ${token}` : '' },
    });
    if (!res.ok) return null;
    return res.json();
  } catch {
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════════

function UsageBar({ percentage }: { percentage: number }) {
  const getColor = () => {
    if (percentage >= 100) return 'bg-danger-500';
    if (percentage >= 80) return 'bg-amber-500';
    return 'bg-primary-500';
  };

  return (
    <div className="h-1.5 w-full rounded-full bg-gray-200 overflow-hidden">
      <div
        className={`h-full rounded-full transition-all ${getColor()}`}
        style={{ width: `${Math.min(percentage, 100)}%` }}
      />
    </div>
  );
}

function UsageRow({
  icon: Icon,
  label,
  current,
  limit,
  percentage,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  current: number;
  limit: number | null;
  percentage: number;
}) {
  const formatValue = (value: number) => {
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="h-4 w-4 text-gray-400 flex-shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-600">{label}</span>
          <span className="text-gray-500">
            {formatValue(current)} / {limit === null ? 'ilim.' : formatValue(limit)}
          </span>
        </div>
        <UsageBar percentage={percentage} />
      </div>
      {percentage >= 80 && (
        <AlertTriangle className={`h-4 w-4 flex-shrink-0 ${percentage >= 100 ? 'text-danger-500' : 'text-amber-500'}`} />
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN WIDGET
// ═══════════════════════════════════════════════════════════════════════════════

export function UsageWidget() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['usage-widget'],
    queryFn: fetchUsage,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  if (isLoading) {
    return (
      <div className="card p-4">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-1/3" />
          <div className="h-2 bg-gray-200 rounded" />
          <div className="h-2 bg-gray-200 rounded" />
          <div className="h-2 bg-gray-200 rounded" />
        </div>
      </div>
    );
  }

  if (error || !data) {
    return null; // Silently fail - widget is optional
  }

  const { tier, usage, warnings, upgradeRecommendation, billingPeriod } = data;

  return (
    <div className="card overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
        <div>
          <h3 className="font-medium text-gray-900 text-sm">Plan {tier.name}</h3>
          <p className="text-xs text-gray-500">
            {billingPeriod.daysRemaining} dias restantes
          </p>
        </div>
        <Link
          href="/dashboard/settings/billing"
          className="text-xs text-primary-600 hover:underline flex items-center gap-1"
        >
          Ver detalles
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {/* Usage Items */}
      <div className="p-4 space-y-1">
        <UsageRow icon={Users} {...usage.users} />
        <UsageRow icon={Calendar} {...usage.jobs} />
        <UsageRow icon={FileText} {...usage.invoices} />
        <UsageRow icon={HardDrive} {...usage.storage} />
      </div>

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="px-4 pb-3">
          {warnings.slice(0, 2).map((warning, i) => (
            <div
              key={i}
              className={`text-xs px-2 py-1.5 rounded mb-1 ${
                warning.percentage >= 100
                  ? 'bg-danger-50 text-danger-700'
                  : 'bg-amber-50 text-amber-700'
              }`}
            >
              {warning.message}
            </div>
          ))}
        </div>
      )}

      {/* Upgrade CTA */}
      {upgradeRecommendation?.recommended && (
        <div className="px-4 pb-4">
          <Link
            href="/dashboard/settings/billing"
            className="flex items-center justify-center gap-2 w-full py-2 bg-gradient-to-r from-primary-600 to-purple-600 text-white rounded-lg text-sm font-medium hover:from-primary-700 hover:to-purple-700 transition-colors"
          >
            Actualizar a {upgradeRecommendation.suggestedTierName}
            <ArrowUpRight className="h-4 w-4" />
          </Link>
        </div>
      )}
    </div>
  );
}

// Compact version for sidebar
export function UsageWidgetCompact() {
  const { data } = useQuery({
    queryKey: ['usage-widget'],
    queryFn: fetchUsage,
    staleTime: 5 * 60 * 1000,
  });

  if (!data) return null;

  const { warnings, upgradeRecommendation } = data;
  const hasCritical = warnings.some((w) => w.percentage >= 100);

  if (!hasCritical && !upgradeRecommendation?.recommended) return null;

  return (
    <Link
      href="/dashboard/settings/billing"
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm ${
        hasCritical ? 'bg-danger-50 text-danger-700' : 'bg-amber-50 text-amber-700'
      }`}
    >
      <AlertTriangle className="h-4 w-4" />
      <span className="flex-1 truncate">
        {hasCritical ? 'Limite alcanzado' : 'Acercandote al limite'}
      </span>
      <ArrowUpRight className="h-4 w-4" />
    </Link>
  );
}
