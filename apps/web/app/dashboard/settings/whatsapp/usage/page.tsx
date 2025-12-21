'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Bot,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Sparkles,
  ArrowUpRight,
  RefreshCw,
} from 'lucide-react';
import { UsageChart, UsageProgress } from '@/components/whatsapp/UsageChart';
import { api } from '@/lib/api-client';

interface UsageStats {
  messagesSent: number;
  messagesReceived: number;
  totalMessages: number;
  aiConversations: number;
  averageResponseTime: number;
  billingCycleStart: string;
  billingCycleEnd: string;
  daysRemaining: number;
}

interface TierLimits {
  monthlyMessages: number;
  aiEnabled: boolean;
  aiConversationsLimit: number;
  templates: number;
  webhooks: boolean;
  analytics: boolean;
  priority: boolean;
}

interface UsageHistoryItem {
  date: string;
  messagesSent: number;
  messagesReceived: number;
  conversationsOpened: number;
  aiResponses: number;
}

interface UsageResponse {
  stats: UsageStats;
  tier: string;
  limits: TierLimits;
  history: UsageHistoryItem[];
  alerts: {
    level: 'none' | 'warning' | 'critical';
    message: string;
  };
  canUpgrade: boolean;
  suggestedTier: string | null;
}

const TIER_DISPLAY_NAMES: Record<string, string> = {
  FREE: 'Gratis',
  INICIAL: 'Inicial',
  PROFESIONAL: 'Profesional',
  EMPRESARIAL: 'Empresarial',
  ENTERPRISE: 'Enterprise',
};

export default function WhatsAppUsagePage() {
  const { data, isLoading, error, refetch, isRefetching } = useQuery({
    queryKey: ['whatsapp-usage'],
    queryFn: () => api.whatsapp.usage.get(),
  });

  const usage = data?.data as UsageResponse | undefined;

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="card p-6 text-center">
          <p className="text-red-600 mb-4">Error al cargar el uso</p>
          <button onClick={() => refetch()} className="btn-primary">
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  if (!usage) {
    return null;
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('es-AR', {
      day: 'numeric',
      month: 'short',
    });
  };

  const isUnlimited = usage.limits.monthlyMessages === -1;
  const usagePercent = isUnlimited
    ? 0
    : Math.round((usage.stats.totalMessages / usage.limits.monthlyMessages) * 100);

  return (
    <div className="mx-auto max-w-4xl py-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/settings/whatsapp"
            className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Volver a WhatsApp
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Uso de WhatsApp
          </h1>
          <p className="text-gray-600">
            Plan {TIER_DISPLAY_NAMES[usage.tier] || usage.tier} • Ciclo actual
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isRefetching}
          className="btn-outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? 'animate-spin' : ''}`} />
          Actualizar
        </button>
      </div>

      {/* Alert Banner */}
      {usage.alerts.level !== 'none' && (
        <div
          className={`p-4 rounded-lg flex items-start gap-3 ${
            usage.alerts.level === 'critical'
              ? 'bg-red-50 border border-red-200'
              : 'bg-yellow-50 border border-yellow-200'
          }`}
        >
          <AlertTriangle
            className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
              usage.alerts.level === 'critical' ? 'text-red-600' : 'text-yellow-600'
            }`}
          />
          <div className="flex-1">
            <p
              className={`font-medium ${
                usage.alerts.level === 'critical' ? 'text-red-800' : 'text-yellow-800'
              }`}
            >
              {usage.alerts.message}
            </p>
            {usage.canUpgrade && usage.suggestedTier && (
              <Link
                href="/dashboard/settings/billing"
                className={`text-sm underline mt-1 inline-block ${
                  usage.alerts.level === 'critical' ? 'text-red-700' : 'text-yellow-700'
                }`}
              >
                Actualizar a {TIER_DISPLAY_NAMES[usage.suggestedTier] || usage.suggestedTier} →
              </Link>
            )}
          </div>
        </div>
      )}

      {/* Usage Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Messages Card */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <MessageCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Mensajes este mes</p>
              <p className="text-2xl font-bold text-gray-900">
                {usage.stats.totalMessages.toLocaleString('es-AR')}
              </p>
            </div>
          </div>
          <UsageProgress
            used={usage.stats.totalMessages}
            limit={usage.limits.monthlyMessages}
            showLabel={false}
          />
          <p className="text-xs text-gray-500 mt-2">
            {isUnlimited
              ? 'Mensajes ilimitados'
              : `${usage.limits.monthlyMessages - usage.stats.totalMessages} mensajes restantes`}
          </p>
        </div>

        {/* AI Conversations Card */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Bot className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Conversaciones IA</p>
              <p className="text-2xl font-bold text-gray-900">
                {usage.stats.aiConversations.toLocaleString('es-AR')}
              </p>
            </div>
          </div>
          {usage.limits.aiEnabled ? (
            <>
              <UsageProgress
                used={usage.stats.aiConversations}
                limit={usage.limits.aiConversationsLimit}
                showLabel={false}
              />
              <p className="text-xs text-gray-500 mt-2">
                {usage.limits.aiConversationsLimit === -1
                  ? 'Ilimitadas'
                  : `${usage.limits.aiConversationsLimit - usage.stats.aiConversations} restantes`}
              </p>
            </>
          ) : (
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-500">
                IA no disponible en tu plan
              </p>
              <Link
                href="/dashboard/settings/billing"
                className="text-xs text-primary-600 hover:underline"
              >
                Activar IA →
              </Link>
            </div>
          )}
        </div>

        {/* Billing Cycle Card */}
        <div className="card p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Ciclo de facturación</p>
              <p className="text-lg font-semibold text-gray-900">
                {formatDate(usage.stats.billingCycleStart)} - {formatDate(usage.stats.billingCycleEnd)}
              </p>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">Días restantes</span>
              <span className="font-medium text-gray-900">{usage.stats.daysRemaining}</span>
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${Math.max(5, 100 - (usage.stats.daysRemaining / 30) * 100)}%`,
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Enviados</p>
          <p className="text-xl font-bold text-green-600">
            {usage.stats.messagesSent.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Recibidos</p>
          <p className="text-xl font-bold text-blue-600">
            {usage.stats.messagesReceived.toLocaleString('es-AR')}
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Tiempo de respuesta</p>
          <p className="text-xl font-bold text-gray-900">
            {usage.stats.averageResponseTime}s
          </p>
        </div>
        <div className="card p-4 text-center">
          <p className="text-sm text-gray-500">Uso del límite</p>
          <p className={`text-xl font-bold ${
            usagePercent >= 100 ? 'text-red-600' : usagePercent >= 80 ? 'text-yellow-600' : 'text-gray-900'
          }`}>
            {isUnlimited ? '∞' : `${usagePercent}%`}
          </p>
        </div>
      </div>

      {/* Usage History Chart */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-gray-400" />
            <h2 className="font-semibold text-gray-900">Historial de uso</h2>
          </div>
          <span className="text-sm text-gray-500">
            Últimos {usage.history.length} días
          </span>
        </div>
        <UsageChart data={usage.history} height={250} />
      </div>

      {/* Features by Tier */}
      <div className="card p-6">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary-600" />
          Características de tu plan
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <FeatureItem
            label="Mensajes mensuales"
            value={
              usage.limits.monthlyMessages === -1
                ? 'Ilimitados'
                : usage.limits.monthlyMessages.toLocaleString('es-AR')
            }
            enabled={true}
          />
          <FeatureItem
            label="IA habilitada"
            value={usage.limits.aiEnabled ? 'Sí' : 'No'}
            enabled={usage.limits.aiEnabled}
          />
          <FeatureItem
            label="Plantillas"
            value={usage.limits.templates.toString()}
            enabled={usage.limits.templates > 0}
          />
          <FeatureItem
            label="Webhooks"
            value={usage.limits.webhooks ? 'Sí' : 'No'}
            enabled={usage.limits.webhooks}
          />
          <FeatureItem
            label="Analytics avanzados"
            value={usage.limits.analytics ? 'Sí' : 'No'}
            enabled={usage.limits.analytics}
          />
          <FeatureItem
            label="Soporte prioritario"
            value={usage.limits.priority ? 'Sí' : 'No'}
            enabled={usage.limits.priority}
          />
        </div>
      </div>

      {/* Upgrade CTA */}
      {usage.canUpgrade && usage.suggestedTier && (
        <div className="card p-6 bg-gradient-to-r from-primary-50 to-primary-100 border-primary-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-primary-900">
                ¿Necesitás más mensajes?
              </h3>
              <p className="text-sm text-primary-700 mt-1">
                Actualizá a {TIER_DISPLAY_NAMES[usage.suggestedTier] || usage.suggestedTier} para obtener más capacidad y funciones.
              </p>
            </div>
            <Link
              href="/dashboard/settings/billing"
              className="btn-primary flex items-center gap-2"
            >
              Ver planes
              <ArrowUpRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

function FeatureItem({
  label,
  value,
  enabled,
}: {
  label: string;
  value: string;
  enabled: boolean;
}) {
  return (
    <div className={`p-3 rounded-lg ${enabled ? 'bg-green-50' : 'bg-gray-50'}`}>
      <p className="text-sm text-gray-500">{label}</p>
      <p className={`font-medium ${enabled ? 'text-green-700' : 'text-gray-400'}`}>
        {value}
      </p>
    </div>
  );
}
