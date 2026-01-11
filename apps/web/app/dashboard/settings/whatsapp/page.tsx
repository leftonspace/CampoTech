'use client';

import { useState, useEffect } from 'react';
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
  Smartphone,
  Bot,
  Copy,
  Check,
  BarChart3,
} from 'lucide-react';

interface WhatsAppSettings {
  integrationType: 'NONE' | 'WAME_LINK' | 'BSP_API';
  isConfigured: boolean;
  personalNumber?: string;
  displayPersonalNumber?: string;
  hasPersonalNumber: boolean;
  hasBspCredentials: boolean;
  hasPhoneNumberId: boolean;
  hasBusinessAccountId: boolean;
  hasAccessToken: boolean;
  hasAppSecret: boolean;
  hasWebhookVerifyToken: boolean;
  subscriptionTier: string;
  canUseBsp: boolean;
}

export default function WhatsAppSettingsPage() {
  const queryClient = useQueryClient();
  const [showBspCredentials, setShowBspCredentials] = useState(false);
  const [personalNumber, setPersonalNumber] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [businessAccountId, setBusinessAccountId] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [appSecret, setAppSecret] = useState('');
  const [webhookVerifyToken, setWebhookVerifyToken] = useState('');
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['settings-whatsapp'],
    queryFn: () => api.settings.whatsapp.get(),
  });

  const settings = data?.data as WhatsAppSettings | undefined;

  // Initialize personal number from settings
  useEffect(() => {
    if (settings?.personalNumber) {
      setPersonalNumber(settings.personalNumber);
    }
  }, [settings?.personalNumber]);

  const savePersonalNumberMutation = useMutation({
    mutationFn: (number: string) =>
      fetch('/api/settings/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalNumber: number }),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
    },
  });

  const saveBspCredentialsMutation = useMutation({
    mutationFn: (data: {
      phoneNumberId: string;
      businessAccountId: string;
      accessToken: string;
      appSecret: string;
      webhookVerifyToken: string;
    }) =>
      fetch('/api/settings/whatsapp', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }).then((res) => res.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
      setShowBspCredentials(false);
    },
  });

  const testMutation = useMutation({
    mutationFn: () => api.settings.whatsapp.testConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-whatsapp'] });
    },
  });

  const handleSavePersonalNumber = () => {
    savePersonalNumberMutation.mutate(personalNumber);
  };

  const handleSaveBspCredentials = () => {
    saveBspCredentialsMutation.mutate({
      phoneNumberId,
      businessAccountId,
      accessToken,
      appSecret,
      webhookVerifyToken,
    });
  };

  const handleCopyWaLink = () => {
    if (settings?.personalNumber) {
      const waLink = `https://wa.me/${settings.personalNumber}`;
      navigator.clipboard.writeText(waLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatPhoneInput = (value: string) => {
    // Allow only digits, +, spaces, and dashes
    return value.replace(/[^\d+\s\-]/g, '');
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary-500 border-t-transparent" />
      </div>
    );
  }

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
          <p className="text-gray-500">Configurá tu integración de WhatsApp</p>
        </div>
      </div>

      {/* Status Overview */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div
            className={`rounded-full p-3 ${
              settings?.isConfigured
                ? 'bg-success-50 text-success-500'
                : 'bg-warning-50 text-warning-500'
            }`}
          >
            {settings?.isConfigured ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <AlertCircle className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {settings?.isConfigured
                ? 'WhatsApp configurado'
                : 'No configurado'}
            </p>
            <p className="text-sm text-gray-500">
              {settings?.integrationType === 'WAME_LINK' && settings?.displayPersonalNumber
                ? `Usando número personal: ${settings.displayPersonalNumber}`
                : settings?.integrationType === 'BSP_API'
                ? 'WhatsApp Business API activo'
                : 'Configurá tu número de WhatsApp para empezar'}
            </p>
          </div>
          {!settings?.isConfigured && (
            <Link href="/dashboard/settings/whatsapp/setup" className="btn-primary">
              Configurar
            </Link>
          )}
        </div>
      </div>

      {/* Personal Number Section (wa.me links) */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full p-2 bg-green-100 text-green-600">
            <Smartphone className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-medium text-gray-900">Número Personal</h2>
            <p className="text-sm text-gray-500">
              Usá tu WhatsApp personal para que tus clientes te contacten
            </p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="label mb-1 block">
              <Phone className="inline h-4 w-4 mr-1" />
              Tu número de WhatsApp
            </label>
            <div className="flex gap-2">
              <input
                type="tel"
                value={personalNumber}
                onChange={(e) => setPersonalNumber(formatPhoneInput(e.target.value))}
                placeholder="Ej: +54 11 5555-1234"
                className="input flex-1"
              />
              <button
                onClick={handleSavePersonalNumber}
                disabled={savePersonalNumberMutation.isPending || !personalNumber}
                className="btn-primary"
              >
                {savePersonalNumberMutation.isPending ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              Ingresá tu número con código de país (ej: +54 para Argentina)
            </p>
          </div>

          {/* Preview wa.me link */}
          {settings?.personalNumber && (
            <div className="mt-4 p-4 bg-green-50 rounded-lg">
              <p className="text-sm font-medium text-green-800 mb-2">
                Tu link de WhatsApp:
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 p-2 bg-white rounded text-sm font-mono text-green-700 break-all">
                  https://wa.me/{settings.personalNumber}
                </code>
                <button
                  onClick={handleCopyWaLink}
                  className="p-2 rounded-md hover:bg-green-100 text-green-600"
                  title="Copiar link"
                >
                  {copied ? <Check className="h-5 w-5" /> : <Copy className="h-5 w-5" />}
                </button>
              </div>
              <div className="mt-3 flex gap-2">
                <a
                  href={`https://wa.me/${settings.personalNumber}?text=${encodeURIComponent('Hola, quiero hacer una consulta')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-outline text-sm py-1.5"
                >
                  <ExternalLink className="h-4 w-4 mr-1" />
                  Probar link
                </a>
              </div>
            </div>
          )}
        </div>

        {/* Benefits */}
        <div className="mt-6 pt-4 border-t">
          <p className="text-sm font-medium text-gray-700 mb-2">Con tu número personal podés:</p>
          <ul className="text-sm text-gray-600 space-y-1">
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Agregar botón de WhatsApp en facturas
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Permitir consultas desde el perfil de cliente
            </li>
            <li className="flex items-center gap-2">
              <CheckCircle className="h-4 w-4 text-green-500" />
              Generar código QR para tarjetas de visita
            </li>
          </ul>
        </div>
      </div>

      {/* BSP API Section (Professional+ tiers) */}
      <div className="card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="rounded-full p-2 bg-purple-100 text-purple-600">
            <Bot className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-medium text-gray-900">WhatsApp Business API</h2>
            <p className="text-sm text-gray-500">
              Automatizá respuestas con IA y obtené un número exclusivo
            </p>
          </div>
          {!settings?.canUseBsp && (
            <Link
              href="/dashboard/settings/billing"
              className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 hover:bg-purple-200"
            >
              Plan Profesional
            </Link>
          )}
        </div>

        {settings?.canUseBsp ? (
          <div className="space-y-4">
            {/* BSP Status */}
            {settings.hasBspCredentials ? (
              <div className="p-3 rounded-lg bg-purple-50 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-purple-600" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-purple-800">
                    WhatsApp Business API configurado
                  </p>
                  <p className="text-xs text-purple-600">
                    Tus clientes pueden contactarte y la IA responderá automáticamente
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href="/dashboard/settings/whatsapp/usage"
                    className="btn-outline text-sm py-1.5"
                  >
                    <BarChart3 className="h-4 w-4 mr-1" />
                    Ver uso
                  </Link>
                  <button
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                    className="btn-outline text-sm py-1.5"
                  >
                    <RefreshCw className={`h-4 w-4 mr-1 ${testMutation.isPending ? 'animate-spin' : ''}`} />
                    Probar
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-3 rounded-lg bg-gray-50 flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-gray-400" />
                <p className="text-sm text-gray-600">
                  No has configurado las credenciales de WhatsApp Business API
                </p>
              </div>
            )}

            {/* Edit Credentials Button */}
            {!showBspCredentials && (
              <button
                onClick={() => setShowBspCredentials(true)}
                className="text-sm text-primary-600 hover:underline"
              >
                {settings.hasBspCredentials ? 'Editar credenciales' : 'Configurar credenciales'}
              </button>
            )}

            {/* Credentials Form */}
            {showBspCredentials && (
              <div className="space-y-4 mt-4 p-4 bg-gray-50 rounded-lg">
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

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={handleSaveBspCredentials}
                    disabled={saveBspCredentialsMutation.isPending}
                    className="btn-primary"
                  >
                    {saveBspCredentialsMutation.isPending ? 'Guardando...' : 'Guardar credenciales'}
                  </button>
                  <button
                    onClick={() => setShowBspCredentials(false)}
                    className="btn-outline"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Webhook Info */}
            {settings.hasBspCredentials && (
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <h3 className="text-sm font-medium text-gray-700 mb-2">
                  URL del Webhook
                </h3>
                <code className="block p-2 bg-white rounded text-sm font-mono break-all">
                  https://api.campo.tech/webhooks/whatsapp
                </code>
                <p className="text-xs text-gray-500 mt-2">
                  Configurá esta URL en tu aplicación de Meta Business
                </p>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600 mb-3">
              Con el plan <strong>Profesional</strong> obtenés:
            </p>
            <ul className="text-sm text-gray-600 space-y-2">
              <li className="flex items-center gap-2">
                <Bot className="h-4 w-4 text-purple-500" />
                IA que responde automáticamente a tus clientes
              </li>
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-purple-500" />
                Número de WhatsApp exclusivo para tu negocio
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-purple-500" />
                Historial completo de conversaciones
              </li>
            </ul>
            <Link
              href="/dashboard/settings/billing"
              className="btn-primary mt-4 inline-flex"
            >
              Actualizar a Profesional
            </Link>
          </div>
        )}
      </div>

      {/* Help Section */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">
          Preguntas frecuentes
        </h2>
        <div className="space-y-4 text-sm">
          <div>
            <p className="font-medium text-gray-700">
              ¿Cuál es la diferencia entre usar mi número personal y el Business API?
            </p>
            <p className="text-gray-600 mt-1">
              Con tu número personal, los clientes te escriben directamente a tu WhatsApp.
              Con el Business API, obtenés un número exclusivo para tu negocio y la IA puede responder automáticamente.
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-700">
              ¿Puedo usar ambos al mismo tiempo?
            </p>
            <p className="text-gray-600 mt-1">
              Sí, podés tener tu número personal configurado como alternativa mientras usás el Business API.
            </p>
          </div>
          <div>
            <p className="font-medium text-gray-700">
              ¿Cómo obtengo las credenciales del Business API?
            </p>
            <p className="text-gray-600 mt-1">
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
              {' '}y seguí los pasos para configurar WhatsApp en tu app.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
