/**
 * Cost Dashboard Page (Phase 8A.1.1)
 * ===================================
 *
 * Admin dashboard for monitoring costs across all paid services.
 */

import { Suspense } from 'react';

// Service display names and colors
const SERVICE_CONFIG: Record<string, { name: string; color: string }> = {
  openai: { name: 'OpenAI', color: '#10a37f' },
  twilio: { name: 'Twilio', color: '#f22f46' },
  maps: { name: 'Google Maps', color: '#4285f4' },
  whatsapp: { name: 'WhatsApp', color: '#25d366' },
  supabase: { name: 'Supabase', color: '#3ecf8e' },
  vercel: { name: 'Vercel', color: '#000000' },
  sentry: { name: 'Sentry', color: '#362d59' },
};

interface CostData {
  currentMonth: {
    month: string;
    total: number;
    budget: number;
    percentUsed: number;
    byService: Record<string, number>;
  };
  today: {
    date: string;
    total: number;
    budget: number;
    percentUsed: number;
    byService: Record<string, number>;
    overBudget: string[];
    nearBudget: string[];
  };
  trend: Array<{
    date: string;
    total: number;
    byService: Record<string, number>;
  }>;
  budgets: Record<string, { daily: number; monthly: number }>;
}

async function getCostData(): Promise<CostData | null> {
  try {
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
    const res = await fetch(`${apiUrl}/api/admin/costs`, {
      next: { revalidate: 60 }, // Revalidate every minute
    });

    if (!res.ok) {
      console.error('Failed to fetch cost data:', res.status);
      return null;
    }

    return res.json();
  } catch (error) {
    console.error('Error fetching cost data:', error);
    return null;
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

function getProgressColor(percent: number): string {
  if (percent >= 100) return 'bg-red-500';
  if (percent >= 80) return 'bg-yellow-500';
  return 'bg-green-500';
}

function CostSummaryCard({
  title,
  total,
  budget,
  percentUsed,
  period,
}: {
  title: string;
  total: number;
  budget: number;
  percentUsed: number;
  period: string;
}) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-sm font-medium text-slate-500">{title}</h3>
          <p className="text-3xl font-bold text-slate-900 mt-1">
            {formatCurrency(total)}
          </p>
        </div>
        <span className="text-sm text-slate-400">{period}</span>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Budget</span>
          <span className="font-medium">{formatCurrency(budget)}</span>
        </div>

        <div className="w-full bg-slate-100 rounded-full h-2.5">
          <div
            className={`h-2.5 rounded-full transition-all ${getProgressColor(percentUsed)}`}
            style={{ width: `${Math.min(percentUsed, 100)}%` }}
          />
        </div>

        <div className="flex justify-between text-sm">
          <span className="text-slate-500">Used</span>
          <span
            className={`font-medium ${
              percentUsed >= 100
                ? 'text-red-600'
                : percentUsed >= 80
                  ? 'text-yellow-600'
                  : 'text-green-600'
            }`}
          >
            {percentUsed.toFixed(1)}%
          </span>
        </div>
      </div>
    </div>
  );
}

function ServiceBreakdown({ byService, budgets }: { byService: Record<string, number>; budgets: Record<string, { daily: number; monthly: number }> }) {
  const services = Object.entries(byService)
    .filter(([_, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1]);

  if (services.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        No cost data recorded yet
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {services.map(([service, amount]) => {
        const config = SERVICE_CONFIG[service] || { name: service, color: '#6b7280' };
        const budget = budgets[service]?.monthly || 100;
        const percent = (amount / budget) * 100;

        return (
          <div key={service} className="space-y-2">
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: config.color }}
                />
                <span className="font-medium text-slate-700">{config.name}</span>
              </div>
              <span className="text-slate-900 font-semibold">
                {formatCurrency(amount)}
              </span>
            </div>

            <div className="w-full bg-slate-100 rounded-full h-2">
              <div
                className={`h-2 rounded-full ${getProgressColor(percent)}`}
                style={{
                  width: `${Math.min(percent, 100)}%`,
                  backgroundColor: percent < 80 ? config.color : undefined,
                }}
              />
            </div>

            <div className="flex justify-between text-xs text-slate-500">
              <span>Monthly budget: {formatCurrency(budget)}</span>
              <span>{percent.toFixed(1)}% used</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AlertsSection({ overBudget, nearBudget }: { overBudget: string[]; nearBudget: string[] }) {
  if (overBudget.length === 0 && nearBudget.length === 0) {
    return (
      <div className="flex items-center gap-2 text-green-600 bg-green-50 p-4 rounded-lg">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>All services within budget</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {overBudget.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-red-700 font-medium mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Over Budget
          </div>
          <ul className="text-sm text-red-600 space-y-1">
            {overBudget.map((service) => (
              <li key={service} className="capitalize">• {service}</li>
            ))}
          </ul>
        </div>
      )}

      {nearBudget.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center gap-2 text-yellow-700 font-medium mb-2">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            Near Budget (80%+)
          </div>
          <ul className="text-sm text-yellow-600 space-y-1">
            {nearBudget.map((service) => (
              <li key={service} className="capitalize">• {service}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function TrendChart({ trend }: { trend: CostData['trend'] }) {
  if (trend.length === 0) {
    return (
      <div className="text-center text-slate-500 py-8">
        No trend data available
      </div>
    );
  }

  const maxTotal = Math.max(...trend.map((d) => d.total), 1);
  const last7Days = trend.slice(-7);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2 h-32">
        {last7Days.map((day, index) => {
          const height = (day.total / maxTotal) * 100;
          const date = new Date(day.date);
          const dayName = date.toLocaleDateString('es-AR', { weekday: 'short' });

          return (
            <div key={day.date} className="flex-1 flex flex-col items-center">
              <div className="w-full bg-slate-100 rounded-t relative" style={{ height: '100px' }}>
                <div
                  className="absolute bottom-0 w-full bg-blue-500 rounded-t transition-all hover:bg-blue-600"
                  style={{ height: `${height}%` }}
                  title={`${formatCurrency(day.total)}`}
                />
              </div>
              <span className="text-xs text-slate-500 mt-2">{dayName}</span>
            </div>
          );
        })}
      </div>

      <div className="text-sm text-slate-500 text-center">
        Last 7 days • Total: {formatCurrency(last7Days.reduce((sum, d) => sum + d.total, 0))}
      </div>
    </div>
  );
}

async function CostDashboardContent() {
  const data = await getCostData();

  if (!data) {
    return (
      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
        <p className="text-yellow-700">
          Unable to load cost data. Make sure the web app API is running.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <CostSummaryCard
          title="Monthly Spend"
          total={data.currentMonth.total}
          budget={data.currentMonth.budget}
          percentUsed={data.currentMonth.percentUsed}
          period={data.currentMonth.month}
        />
        <CostSummaryCard
          title="Today's Spend"
          total={data.today.total}
          budget={data.today.budget}
          percentUsed={data.today.percentUsed}
          period={data.today.date}
        />
      </div>

      {/* Alerts */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Budget Status</h2>
        <AlertsSection
          overBudget={data.today.overBudget}
          nearBudget={data.today.nearBudget}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Service Breakdown */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Cost by Service (This Month)
          </h2>
          <ServiceBreakdown
            byService={data.currentMonth.byService}
            budgets={data.budgets}
          />
        </div>

        {/* Trend Chart */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Daily Trend
          </h2>
          <TrendChart trend={data.trend} />
        </div>
      </div>
    </div>
  );
}

export default function CostsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Cost Dashboard</h1>
          <p className="text-slate-500 mt-1">
            Monitor costs across all external services
          </p>
        </div>

        <div className="flex items-center gap-2 text-sm text-slate-500">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Updated every minute
        </div>
      </div>

      <Suspense
        fallback={
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="h-48 bg-slate-200 rounded-xl" />
              <div className="h-48 bg-slate-200 rounded-xl" />
            </div>
            <div className="h-32 bg-slate-200 rounded-xl" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-slate-200 rounded-xl" />
              <div className="h-64 bg-slate-200 rounded-xl" />
            </div>
          </div>
        }
      >
        <CostDashboardContent />
      </Suspense>
    </div>
  );
}
