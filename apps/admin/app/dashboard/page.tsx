import { mockDashboardMetrics, mockRevenueByTier, mockFailedPayments, mockAIConversations } from '@/lib/mock-data';

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
  }).format(value);
}

function formatNumber(value: number): string {
  return new Intl.NumberFormat('es-AR').format(value);
}

function HealthIndicator({ status }: { status: 'healthy' | 'degraded' | 'down' }) {
  const colors = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  };
  const labels = {
    healthy: 'Operativo',
    degraded: 'Degradado',
    down: 'Caído',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium`}>
      <span className={`w-2 h-2 rounded-full ${colors[status]}`} />
      {labels[status]}
    </span>
  );
}

export default function DashboardPage() {
  const metrics = mockDashboardMetrics;
  const revenueByTier = mockRevenueByTier;
  const failedPayments = mockFailedPayments;
  const recentAI = mockAIConversations.slice(0, 3);

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
        <p className="text-slate-500 mt-1">Resumen general de CampoTech</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {/* Total Businesses */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <span className="text-xs font-medium text-green-600 bg-green-100 px-2 py-1 rounded-full">
              +{metrics.newSignupsThisWeek} esta semana
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatNumber(metrics.totalBusinesses)}</p>
          <p className="text-sm text-slate-500 mt-1">Negocios totales</p>
          <p className="text-xs text-slate-400 mt-2">
            {formatNumber(metrics.activeBusinesses)} activos
          </p>
        </div>

        {/* MRR */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-green-600">MRR</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatCurrency(metrics.mrr)}</p>
          <p className="text-sm text-slate-500 mt-1">Ingresos mensuales</p>
          <p className="text-xs text-slate-400 mt-2">
            +{metrics.newSignupsThisMonth} nuevos este mes
          </p>
        </div>

        {/* Churn Rate */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-yellow-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-yellow-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" />
              </svg>
            </div>
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${
              metrics.churnRate < 3 ? 'text-green-600 bg-green-100' : 'text-red-600 bg-red-100'
            }`}>
              {metrics.churnRate < 3 ? 'Saludable' : 'Atención'}
            </span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{metrics.churnRate}%</p>
          <p className="text-sm text-slate-500 mt-1">Tasa de abandono</p>
          <p className="text-xs text-slate-400 mt-2">Últimos 30 días</p>
        </div>

        {/* Active Users */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
              <svg className="w-6 h-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <span className="text-xs font-medium text-slate-500">Hoy</span>
          </div>
          <p className="text-3xl font-bold text-slate-900">{formatNumber(metrics.activeUsersToday)}</p>
          <p className="text-sm text-slate-500 mt-1">Usuarios activos</p>
          <p className="text-xs text-slate-400 mt-2">En las últimas 24h</p>
        </div>
      </div>

      {/* System Health & Revenue by Tier */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* System Health */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Estado del Sistema</h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700">API Principal</span>
              </div>
              <HealthIndicator status={metrics.systemHealth.api} />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700">Base de Datos</span>
              </div>
              <HealthIndicator status={metrics.systemHealth.database} />
            </div>
            <div className="flex items-center justify-between py-3 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700">WhatsApp IA</span>
              </div>
              <HealthIndicator status={metrics.systemHealth.whatsapp} />
            </div>
            <div className="flex items-center justify-between py-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-100 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                </div>
                <span className="font-medium text-slate-700">Pagos (MercadoPago)</span>
              </div>
              <HealthIndicator status={metrics.systemHealth.payments} />
            </div>
          </div>
        </div>

        {/* Revenue by Tier */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900 mb-4">Ingresos por Plan</h2>
          <div className="space-y-4">
            {revenueByTier.map((tier) => (
              <div key={tier.tier} className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-700">{tier.tier}</span>
                  <span className="text-slate-500">
                    {formatCurrency(tier.revenue)} ({tier.count} negocios)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-blue-600 rounded-full"
                    style={{ width: `${tier.percentage}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <div className="mt-6 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between text-sm">
              <span className="font-semibold text-slate-900">Total MRR</span>
              <span className="font-semibold text-slate-900">
                {formatCurrency(revenueByTier.reduce((sum, t) => sum + t.revenue, 0))}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Failed Payments & Recent AI Conversations */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Failed Payments Alert */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Pagos Fallidos</h2>
            <span className="text-xs font-medium text-red-600 bg-red-100 px-2 py-1 rounded-full">
              {failedPayments.length} pendientes
            </span>
          </div>
          <div className="space-y-3">
            {failedPayments.map((payment) => (
              <div
                key={payment.id}
                className="flex items-center justify-between p-3 bg-red-50 rounded-lg border border-red-100"
              >
                <div>
                  <p className="font-medium text-slate-900">{payment.businessName}</p>
                  <p className="text-sm text-slate-500">{payment.reason}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-red-600">{formatCurrency(payment.amount)}</p>
                  <p className="text-xs text-slate-400">Reintentos: {payment.retryCount}</p>
                </div>
              </div>
            ))}
          </div>
          <a
            href="/dashboard/payments"
            className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver todos los pagos
          </a>
        </div>

        {/* Recent AI Conversations */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-slate-900">Conversaciones IA Recientes</h2>
          </div>
          <div className="space-y-3">
            {recentAI.map((conv) => (
              <div
                key={conv.id}
                className="flex items-center justify-between p-3 bg-slate-50 rounded-lg"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-slate-900 truncate">{conv.businessName}</p>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        conv.status === 'completed'
                          ? 'bg-green-100 text-green-700'
                          : conv.status === 'escalated'
                          ? 'bg-yellow-100 text-yellow-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {conv.status === 'completed' ? 'Completado' : conv.status === 'escalated' ? 'Escalado' : 'Fallido'}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{conv.summary}</p>
                </div>
                <div className="ml-4 text-right">
                  <p className="text-sm font-medium text-slate-700">
                    {Math.round(conv.confidenceScore * 100)}%
                  </p>
                  <p className="text-xs text-slate-400">confianza</p>
                </div>
              </div>
            ))}
          </div>
          <a
            href="/dashboard/ai"
            className="mt-4 block text-center text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Ver todas las conversaciones
          </a>
        </div>
      </div>
    </div>
  );
}
