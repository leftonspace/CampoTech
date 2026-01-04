'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { ArrowLeft, Upload, CheckCircle, AlertCircle, RefreshCw, FileCheck } from 'lucide-react';

interface AFIPSettings {
  configured: boolean;
  environment: 'homologation' | 'production';
  puntoVenta: number;
  certificateExpiry?: string;
  lastTokenRefresh?: string;
}

export default function AFIPSettingsPage() {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');

  const { data } = useQuery({
    queryKey: ['settings-afip'],
    queryFn: () => api.settings.afip.get(),
  });

  const settings = data?.data as AFIPSettings | undefined;

  const testMutation = useMutation({
    mutationFn: () => api.settings.afip.testConnection(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings-afip'] });
    },
  });

  const handleFileUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const formData = new FormData();
    formData.append('certificate', file);
    formData.append('password', password);

    // In real app, this would upload the certificate
    console.log('Uploading certificate...');
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
          <h1 className="text-2xl font-bold text-gray-900">Configuración AFIP</h1>
          <p className="text-gray-500">Facturación electrónica</p>
        </div>
      </div>

      {/* Status card */}
      <div className="card p-6">
        <div className="flex items-center gap-4">
          <div
            className={`rounded-full p-3 ${settings?.configured
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
              {settings?.configured ? 'AFIP configurado' : 'AFIP no configurado'}
            </p>
            <p className="text-sm text-gray-500">
              {settings?.configured
                ? `Ambiente: ${settings.environment === 'production' ? 'Producción' : 'Homologación'} | Punto de venta: ${settings.puntoVenta}`
                : 'Subí tu certificado para empezar a facturar'}
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
              Probar conexión
            </button>
          )}
        </div>
      </div>

      {/* Certificate upload */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Certificado digital</h2>

        {settings?.certificateExpiry && (
          <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
            <FileCheck className="h-4 w-4" />
            <span>
              Certificado válido hasta:{' '}
              <strong>{new Date(settings.certificateExpiry).toLocaleDateString('es-AR')}</strong>
            </span>
          </div>
        )}

        <form onSubmit={handleFileUpload} className="space-y-4">
          <div>
            <label className="label mb-1 block">Archivo .p12 o .pfx</label>
            <div className="flex items-center gap-2">
              <label className="btn-outline cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                {file ? file.name : 'Seleccionar archivo'}
                <input
                  type="file"
                  accept=".p12,.pfx"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <div>
            <label htmlFor="password" className="label mb-1 block">
              Contraseña del certificado
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Contraseña"
              className="input"
            />
          </div>

          <button
            type="submit"
            disabled={!file || !password}
            className="btn-primary"
          >
            Subir certificado
          </button>
        </form>
      </div>

      {/* Environment settings */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Ambiente</h2>

        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="environment"
              value="homologation"
              checked={settings?.environment === 'homologation'}
              onChange={() => { }}
              className="h-4 w-4 text-primary-600"
            />
            <div>
              <p className="font-medium text-gray-900">Homologación</p>
              <p className="text-sm text-gray-500">Para pruebas, no genera facturas reales</p>
            </div>
          </label>

          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="environment"
              value="production"
              checked={settings?.environment === 'production'}
              onChange={() => { }}
              className="h-4 w-4 text-primary-600"
            />
            <div>
              <p className="font-medium text-gray-900">Producción</p>
              <p className="text-sm text-gray-500">Facturas reales con validez fiscal</p>
            </div>
          </label>
        </div>
      </div>

      {/* Punto de venta */}
      <div className="card p-6">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Punto de venta</h2>
        <p className="mb-4 text-sm text-gray-500">
          El punto de venta debe estar habilitado en AFIP para factura electrónica
        </p>
        <div className="max-w-xs">
          <input
            type="number"
            min={1}
            max={99999}
            value={settings?.puntoVenta || ''}
            onChange={() => { }}
            placeholder="Ej: 1"
            className="input"
          />
        </div>
      </div>
    </div>
  );
}
