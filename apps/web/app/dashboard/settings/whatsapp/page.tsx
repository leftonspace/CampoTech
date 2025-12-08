'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import {
  ArrowLeft,
  MessageCircle,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Key,
  Phone,
  Building2,
  Shield,
  ExternalLink,
  AlertTriangle,
} from 'lucide-react';

interface WhatsAppSettings {
  configured: boolean;
  phoneNumberId?: string;
  displayPhoneNumber?: string;
  businessAccountId?: string;
  verifiedName?: string;
  qualityRating?: 'GREEN' | 'YELLOW' | 'RED';
  messagingLimit?: string;
  webhookConfigured?: boolean;
  panicMode?: {
    active: boolean;
    reason?: string;
    triggeredAt?: string;
  };
}

export default function WhatsAppSettingsPage() {
  const queryClient = useQueryClient();
  const [showCredentials, setShowCredentials] = useState(false);
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['settings-whatsapp'],
    queryFn: () => api.settings.whatsapp.get(),
  });

  const settings = data?.data as WhatsAppSettings | undefined;

  const testMutation = useMutation({
    mutationFn: () => api.settings.whatsapp.testConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data: {
      phoneNumberId: string;
      businessAccountId: string;
      accessToken: string;
      appSecret: string;
      webhookVerifyToken: string;
    }) => api.settings.whatsapp.save(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
      setShowCredentials(false);
    },
  });

  const resolvePanicMutation = useMutation({
    mutationFn: () => api.settings.whatsapp.resolvePanic(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
    },
  });

  const handleSave = () => {
    saveMutation.mutate({
      phoneNumberId,
      businessAccountId,
      accessToken,
      appSecret,
      webhookVerifyToken,
    });
  };

  const getQualityBadge = (rating: string) => {
    switch (rating) {
      case 'GREEN':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-success-50 text-success-700">
            Buena calidad
          </span>
        );
      case 'YELLOW':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-warning-50 text-warning-700">
            Calidad media
          </span>
        );
      case 'RED':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded-full bg-danger-50 text-danger-700">
            Calidad baja
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/settings"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">WhatsApp Business</h1>
          <p className="text-gray-500">Configuración de mensajería</p>
        </div>
      </div>

      {/* Panic mode alert */}
      {settings?.panicMode?.active && (
        <div className="p-4 bg-danger-50 border border-danger-200 rounded-lg">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-danger-500 mt-0.5" />
            <div className="flex-1">
              <h3 className="font-medium text-danger-800">Modo Pánico Activado</h3>
              <p className="text-sm text-danger-700 mt-1">
                {settings.panicMode.reason || 'Se detectaron problemas críticos'}
              </p>
              {settings.panicMode.triggeredAt && (
                <p className="text-xs text-danger-600 mt-1">
                  Activado: {new Date(settings.panicMode.triggeredAt).toLocaleString('es-AR')}
                </p>
              )}
              <button
                onClick={() => resolvePanicMutation.mutate()}
                disabled={resolvePanicMutation.isPending}
                className="mt-3 btn-outline text-danger-600 border-danger-300 hover:bg-danger-100"
              >
                {resolvePanicMutation.isPending ? 'Resolviendo...' : 'Resolver manualmente'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Status card */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div
            className={`rounded-full p-3 ${
              settings?.configured
                ? 'bg-success-50 text-success-500'
                : 'bg-warning-50 text-warning-500'
            }`}
          >
            {settings?.configured ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <AlertCircle className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {settings?.configured ? 'WhatsApp configurado' : 'No configurado'}
            </p>
            <p className="text-sm text-gray-500">
              {settings?.configured
                ? `${settings.displayPhoneNumber || 'Número configurado'}`
                : 'Configurá tus credenciales de WhatsApp Business API'}
            </p>
          </div>
          {settings?.configured && (
            <button
              onClick={() => testMutation.mutate()}
              disabled={testMutation.isPending}
              className="btn-outline"
            >
              <RefreshCw
                className={`mr-2 h-4 w-4 ${testMutation.isPending ? 'animate-spin' : ''}`}
              />
              Probar
            </button>
          )}
        </div>

        {/* Status details */}
        {settings?.configured && (
          <div className="mt-4 pt-4 border-t grid gap-3 sm:grid-cols-2">
            {settings.verifiedName && (
              <div className="flex items-center gap-2 text-sm">
                <Building2 className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">{settings.verifiedName}</span>
              </div>
            )}
            {settings.qualityRating && (
              <div className="flex items-center gap-2 text-sm">
                <Shield className="h-4 w-4 text-gray-400" />
                {getQualityBadge(settings.qualityRating)}
              </div>
            )}
            {settings.messagingLimit && (
              <div className="flex items-center gap-2 text-sm">
                <MessageCircle className="h-4 w-4 text-gray-400" />
                <span className="text-gray-600">Límite: {settings.messagingLimit}</span>
              </div>
            )}
            {settings.webhookConfigured !== undefined && (
              <div className="flex items-center gap-2 text-sm">
                {settings.webhookConfigured ? (
                  <CheckCircle className="h-4 w-4 text-success-500" />
                ) : (
                  <AlertCircle className="h-4 w-4 text-warning-500" />
                )}
                <span className="text-gray-600">
                  Webhook {settings.webhookConfigured ? 'configurado' : 'pendiente'}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Credentials form */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-medium text-gray-900">Credenciales</h2>
          {settings?.configured && !showCredentials && (
            <button
              onClick={() => setShowCredentials(true)}
              className="text-sm text-primary-600 hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {(!settings?.configured || showCredentials) && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleSave();
            }}
            className="space-y-4"
          >
            <div>
              <label className="label mb-1 block">
                <Phone className="inline h-4 w-4 mr-1" />
                Phone Number ID
              </label>
              <input
                type="text"
                value={phoneNumberId}
                onChange={(e) => setPhoneNumberId(e.target.value)}
                placeholder="Ej: 123456789012345"
                className="input"
              />
            </div>

            <div>
              <label className="label mb-1 block">
                <Building2 className="inline h-4 w-4 mr-1" />
                Business Account ID
              </label>
              <input
                type="text"
                value={businessAccountId}
                onChange={(e) => setBusinessAccountId(e.target.value)}
                placeholder="Ej: 123456789012345"
                className="input"
              />
            </div>

            <div>
              <label className="label mb-1 block">
                <Key className="inline h-4 w-4 mr-1" />
                Access Token
              </label>
              <input
                type="password"
                value={accessToken}
                onChange={(e) => setAccessToken(e.target.value)}
                placeholder="Token de acceso permanente"
                className="input"
              />
            </div>

            <div>
              <label className="label mb-1 block">
                <Shield className="inline h-4 w-4 mr-1" />
                App Secret
              </label>
              <input
                type="password"
                value={appSecret}
                onChange={(e) => setAppSecret(e.target.value)}
                placeholder="Para validación de webhooks"
                className="input"
              />
            </div>

            <div>
              <label className="label mb-1 block">
                <Key className="inline h-4 w-4 mr-1" />
                Webhook Verify Token
              </label>
              <input
                type="text"
                value={webhookVerifyToken}
                onChange={(e) => setWebhookVerifyToken(e.target.value)}
                placeholder="Token personalizado para verificar webhook"
                className="input"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="btn-primary"
              >
                {saveMutation.isPending ? 'Guardando...' : 'Guardar credenciales'}
              </button>
              {showCredentials && (
                <button
                  type="button"
                  onClick={() => setShowCredentials(false)}
                  className="btn-outline"
                >
                  Cancelar
                </button>
              )}
            </div>
          </form>
        )}
      </div>

      {/* Webhook configuration */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">
          Configuración del Webhook
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          Configurá esta URL en tu aplicación de Meta Business:
        </p>
        <div className="p-3 bg-gray-100 rounded-lg font-mono text-sm break-all">
          https://api.campo.tech/webhooks/whatsapp
        </div>
        <div className="mt-4 space-y-2 text-sm text-gray-600">
          <p><strong>Eventos a suscribir:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>messages</li>
            <li>message_deliveries</li>
            <li>message_reads</li>
            <li>messaging_handovers</li>
          </ul>
        </div>
      </div>

      {/* Help */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">
          Cómo obtener las credenciales
        </h2>
        <ol className="space-y-3 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              1
            </span>
            <span>
              Accedé a{' '}
              <a
                href="https://developers.facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary-600 hover:underline inline-flex items-center gap-1"
              >
                Meta for Developers
                <ExternalLink className="h-3 w-3" />
              </a>
            </span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              2
            </span>
            <span>Seleccioná tu app o creá una nueva de tipo Business</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              3
            </span>
            <span>Agregá el producto WhatsApp a tu aplicación</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              4
            </span>
            <span>Copiá los IDs y tokens de la sección WhatsApp &gt; API Setup</span>
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              5
            </span>
            <span>Generá un token de acceso permanente (System User Token)</span>
          </li>
        </ol>
      </div>
    </div>
  );
}
