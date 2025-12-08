'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ArrowLeft, CheckCircle, AlertCircle, ExternalLink, Unlink } from 'lucide-react';

interface MPSettings {
  connected: boolean;
  userId?: number;
  email?: string;
  publicKey?: string;
  connectedAt?: string;
}

export default function MercadoPagoSettingsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['settings-mercadopago'],
    queryFn: () => api.settings.mercadopago.get(),
  });

  const settings = data?.data as MPSettings | undefined;

  const connectMutation = useMutation({
    mutationFn: async () => {
      const response = await api.settings.mercadopago.getAuthUrl();
      if (response.success && response.data) {
        window.location.href = response.data.url;
      }
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: () => api.settings.mercadopago.disconnect(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-mercadopago'] });
    },
  });

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
          <h1 className="text-2xl font-bold text-gray-900">MercadoPago</h1>
          <p className="text-gray-500">Configuración de pagos</p>
        </div>
      </div>

      {/* Status card */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div
            className={`rounded-full p-3 ${
              settings?.connected
                ? 'bg-success-50 text-success-500'
                : 'bg-warning-50 text-warning-500'
            }`}
          >
            {settings?.connected ? (
              <CheckCircle className="h-6 w-6" />
            ) : (
              <AlertCircle className="h-6 w-6" />
            )}
          </div>
          <div className="flex-1">
            <p className="font-medium text-gray-900">
              {settings?.connected ? 'Cuenta conectada' : 'Sin conexión'}
            </p>
            <p className="text-sm text-gray-500">
              {settings?.connected
                ? `${settings.email} (ID: ${settings.userId})`
                : 'Conectá tu cuenta de MercadoPago para recibir pagos'}
            </p>
          </div>
        </div>

        {!settings?.connected ? (
          <button
            onClick={() => connectMutation.mutate()}
            disabled={connectMutation.isPending}
            className="btn-primary mt-4"
          >
            <ExternalLink className="mr-2 h-4 w-4" />
            {connectMutation.isPending ? 'Conectando...' : 'Conectar con MercadoPago'}
          </button>
        ) : (
          <button
            onClick={() => {
              if (confirm('¿Desconectar la cuenta de MercadoPago?')) {
                disconnectMutation.mutate();
              }
            }}
            disabled={disconnectMutation.isPending}
            className="btn-outline mt-4 text-danger-500 hover:bg-danger-50"
          >
            <Unlink className="mr-2 h-4 w-4" />
            {disconnectMutation.isPending ? 'Desconectando...' : 'Desconectar'}
          </button>
        )}
      </div>

      {/* Info */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">¿Cómo funciona?</h2>
        <ul className="space-y-3 text-sm text-gray-600">
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              1
            </span>
            Conectás tu cuenta de MercadoPago
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              2
            </span>
            Tus clientes reciben un link de pago con cada factura
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              3
            </span>
            Los pagos se acreditan directamente en tu cuenta
          </li>
          <li className="flex gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-medium text-primary-600">
              4
            </span>
            El sistema actualiza automáticamente el estado de las facturas
          </li>
        </ul>
      </div>

      {/* Payment methods */}
      {settings?.connected && (
        <div className="card p-6">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Métodos de pago habilitados</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              'Tarjeta de crédito',
              'Tarjeta de débito',
              'Dinero en cuenta',
              'Rapipago',
              'Pago Fácil',
              'Transferencia bancaria',
            ].map((method) => (
              <div
                key={method}
                className="flex items-center gap-2 rounded-md border bg-gray-50 p-2 text-sm"
              >
                <CheckCircle className="h-4 w-4 text-success-500" />
                {method}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
