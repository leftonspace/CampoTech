'use client';

/**
 * AFIP Settings Page
 * ==================
 * 
 * Phase 4.1 Task 4.1.3: Improve AFIP Certificate Upload UX
 * 
 * Enhanced with:
 * - Help guide with step-by-step instructions
 * - Security notice about encryption
 * - Tab-based interface for upload and help
 */

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import {
  ArrowLeft,
  Upload,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  FileCheck,
  Shield,
  HelpCircle,
  ExternalLink,
  Info,
} from 'lucide-react';

interface AFIPSettings {
  configured: boolean;
  environment: 'homologation' | 'production';
  puntoVenta: number;
  cuit?: string;
  certificateExpiry?: string;
  lastTokenRefresh?: string;
  connectedAt?: string;
}

type TabType = 'upload' | 'help';

export default function AFIPSettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [cuit, setCuit] = useState('');
  const [puntoVenta, setPuntoVenta] = useState('');
  const [environment, setEnvironment] = useState<'homologation' | 'production'>('homologation');
  const [isUploading, setIsUploading] = useState(false);

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
    if (!file || !password || !cuit) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('certificate', file);
      formData.append('password', password);
      formData.append('cuit', cuit.replace(/\D/g, ''));
      formData.append('puntoVenta', puntoVenta || '1');
      formData.append('environment', environment);

      await api.settings.afip.uploadCertificate(formData);
      queryClient.invalidateQueries({ queryKey: ['settings-afip'] });
      setPassword('');
    } catch (error) {
      console.error('Upload failed:', error);
    } finally {
      setIsUploading(false);
    }
  };

  // Format CUIT with dashes (XX-XXXXXXXX-X)
  const handleCuitChange = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) {
      setCuit(digits);
    } else if (digits.length <= 10) {
      setCuit(`${digits.slice(0, 2)}-${digits.slice(2)}`);
    } else {
      setCuit(`${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`);
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
          <h1 className="text-2xl font-bold text-gray-900">AFIP - Facturación Electrónica</h1>
          <p className="text-gray-500">Configuración de certificado digital</p>
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
                ? `CUIT: ${settings.cuit} | Ambiente: ${settings.environment === 'production' ? 'Producción' : 'Homologación'} | PV: ${settings.puntoVenta}`
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

      {/* Tabs */}
      <div className="card overflow-hidden">
        <div className="flex border-b border-gray-200">
          <button
            onClick={() => setActiveTab('upload')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'upload'
              ? 'border-b-2 border-primary-500 bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <Upload className="mr-2 inline h-4 w-4" />
            Subir Certificado
          </button>
          <button
            onClick={() => setActiveTab('help')}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${activeTab === 'help'
              ? 'border-b-2 border-primary-500 bg-primary-50 text-primary-700'
              : 'text-gray-600 hover:bg-gray-50'
              }`}
          >
            <HelpCircle className="mr-2 inline h-4 w-4" />
            ¿Cómo obtenerlo?
          </button>
        </div>

        {/* Upload Tab */}
        {activeTab === 'upload' && (
          <div className="p-6">
            {settings?.certificateExpiry && (
              <div className="mb-4 flex items-center gap-2 text-sm text-gray-600">
                <FileCheck className="h-4 w-4" />
                <span>
                  Certificado válido hasta:{' '}
                  <strong>{new Date(settings.certificateExpiry).toLocaleDateString('es-AR', { timeZone: 'America/Buenos_Aires' })}</strong>
                </span>
              </div>
            )}

            <form onSubmit={handleFileUpload} className="space-y-4">
              {/* CUIT */}
              <div>
                <label htmlFor="cuit" className="label mb-1 block">
                  CUIT
                </label>
                <input
                  id="cuit"
                  type="text"
                  value={cuit}
                  onChange={(e) => handleCuitChange(e.target.value)}
                  placeholder="20-12345678-9"
                  className="input"
                  maxLength={13}
                />
                <p className="mt-1 text-xs text-gray-500">
                  El CUIT de tu empresa o monotributo
                </p>
              </div>

              {/* Certificate File */}
              <div>
                <label className="label mb-1 block">Certificado (.p12 o .pfx)</label>
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
                  {file && (
                    <span className="text-sm text-success-600">
                      <CheckCircle className="inline h-4 w-4 mr-1" />
                      Archivo seleccionado
                    </span>
                  )}
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="label mb-1 block">
                  Contraseña del certificado
                </label>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="La contraseña que elegiste al crear el certificado"
                  className="input"
                />
              </div>

              {/* Security Notice */}
              <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                <div className="flex gap-3">
                  <Shield className="h-5 w-5 shrink-0 text-amber-600" />
                  <div className="text-sm">
                    <p className="font-medium text-amber-800">Almacenamiento seguro</p>
                    <p className="text-amber-700">
                      Tu certificado y contraseña se almacenan encriptados con AES-256-GCM
                      y nunca se comparten. Solo se usan para firmar facturas electrónicas.
                    </p>
                  </div>
                </div>
              </div>

              {/* Environment */}
              <div>
                <label className="label mb-2 block">Ambiente</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="environment"
                      value="homologation"
                      checked={environment === 'homologation'}
                      onChange={() => setEnvironment('homologation')}
                      className="h-4 w-4 text-primary-600"
                    />
                    <span className="text-sm">Homologación (pruebas)</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="environment"
                      value="production"
                      checked={environment === 'production'}
                      onChange={() => setEnvironment('production')}
                      className="h-4 w-4 text-primary-600"
                    />
                    <span className="text-sm">Producción</span>
                  </label>
                </div>
              </div>

              {/* Punto de Venta */}
              <div>
                <label htmlFor="puntoVenta" className="label mb-1 block">
                  Punto de venta
                </label>
                <input
                  id="puntoVenta"
                  type="number"
                  min={1}
                  max={99999}
                  value={puntoVenta}
                  onChange={(e) => setPuntoVenta(e.target.value)}
                  placeholder="Ej: 1"
                  className="input max-w-32"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Debe estar habilitado en AFIP para factura electrónica
                </p>
              </div>

              <button
                type="submit"
                disabled={!file || !password || !cuit || isUploading}
                className="btn-primary"
              >
                {isUploading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Subiendo...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Guardar y probar conexión
                  </>
                )}
              </button>
            </form>
          </div>
        )}

        {/* Help Tab */}
        {activeTab === 'help' && (
          <div className="p-6">
            <div className="prose prose-sm max-w-none">
              <h3 className="flex items-center gap-2 text-lg font-medium text-gray-900">
                <Info className="h-5 w-5 text-primary-500" />
                Cómo obtener tu certificado AFIP
              </h3>

              <div className="mt-4 space-y-4">
                <div className="rounded-lg border bg-gray-50 p-4">
                  <ol className="space-y-3 text-sm text-gray-700">
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        1
                      </span>
                      <div>
                        <p className="font-medium">Ingresá a AFIP con Clave Fiscal</p>
                        <a
                          href="https://auth.afip.gob.ar/contribuyente_/login.xhtml"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary-600 hover:underline inline-flex items-center gap-1"
                        >
                          auth.afip.gob.ar <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        2
                      </span>
                      <div>
                        <p className="font-medium">Ir a &quot;Administrador de Relaciones de Clave Fiscal&quot;</p>
                        <p className="text-gray-500">En el menú de servicios habilitados</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        3
                      </span>
                      <div>
                        <p className="font-medium">Seleccionar &quot;Nueva Relación&quot;</p>
                        <p className="text-gray-500">Agregar un nuevo servicio a tu clave fiscal</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        4
                      </span>
                      <div>
                        <p className="font-medium">Buscar &quot;Factura Electrónica - WSFE&quot;</p>
                        <p className="text-gray-500">Web Service de Factura Electrónica</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        5
                      </span>
                      <div>
                        <p className="font-medium">Generar certificado (.p12)</p>
                        <p className="text-gray-500">Elegí una contraseña segura y guardala</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary-100 text-xs font-bold text-primary-700">
                        6
                      </span>
                      <div>
                        <p className="font-medium">Habilitar punto de venta electrónico</p>
                        <p className="text-gray-500">En &quot;ABM de Puntos de Venta&quot; habilitá uno para factura electrónica</p>
                      </div>
                    </li>
                    <li className="flex gap-3">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success-100 text-xs font-bold text-success-700">
                        ✓
                      </span>
                      <div>
                        <p className="font-medium text-success-700">¡Listo! Subí el certificado aquí</p>
                      </div>
                    </li>
                  </ol>
                </div>

                {/* Video Tutorial Link */}
                <div className="rounded-lg border border-primary-200 bg-primary-50 p-4">
                  <p className="font-medium text-primary-800 mb-2">📹 Video tutorial</p>
                  <a
                    href="https://www.youtube.com/results?search_query=crear+certificado+afip+factura+electronica"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-600 hover:underline inline-flex items-center gap-1"
                  >
                    Ver videos paso a paso en YouTube <ExternalLink className="h-4 w-4" />
                  </a>
                </div>

                {/* Additional Help */}
                <div className="text-sm text-gray-600">
                  <p className="font-medium">¿Necesitás ayuda?</p>
                  <p>
                    Si tenés dudas, contactanos por WhatsApp o consultá con tu contador.
                    El proceso es estándar para cualquier sistema de facturación electrónica.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

