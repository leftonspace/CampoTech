'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Save, Clock, FileText, DollarSign, Bell } from 'lucide-react';

interface LocationSettings {
  operatingHours?: Record<string, { open: string; close: string; closed?: boolean }>;
  maxJobsPerDay?: number;
  pricingMultiplier?: number;
  travelFeePerKm?: number;
  notificationsEnabled?: boolean;
  autoAssignEnabled?: boolean;
}

interface AfipConfig {
  puntoDeVenta: number;
  tiposPuntoDeVenta: string;
  cuit?: string;
  razonSocial?: string;
  condicionIva: string;
  isActive: boolean;
}

const DAYS = [
  { key: 'monday', label: 'Lunes' },
  { key: 'tuesday', label: 'Martes' },
  { key: 'wednesday', label: 'Miércoles' },
  { key: 'thursday', label: 'Jueves' },
  { key: 'friday', label: 'Viernes' },
  { key: 'saturday', label: 'Sábado' },
  { key: 'sunday', label: 'Domingo' },
];

const IVA_CONDITIONS = [
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' },
];

async function fetchLocationSettings(id: string) {
  const response = await fetch(`/api/locations/${id}/settings`);
  return response.json();
}

async function updateLocationSettings(id: string, settings: LocationSettings) {
  const response = await fetch(`/api/locations/${id}/settings`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  return response.json();
}

async function fetchAfipConfig(id: string) {
  const response = await fetch(`/api/locations/${id}/afip`);
  return response.json();
}

async function updateAfipConfig(id: string, config: Partial<AfipConfig>) {
  const response = await fetch(`/api/locations/${id}/afip`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(config),
  });
  return response.json();
}

export default function LocationSettingsPage() {
  const params = useParams();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'hours' | 'capacity' | 'afip'>('hours');

  const { data: settingsData, isLoading: loadingSettings } = useQuery({
    queryKey: ['location-settings', params.id],
    queryFn: () => fetchLocationSettings(params.id as string),
    enabled: !!params.id,
  });

  const { data: afipData, isLoading: loadingAfip } = useQuery({
    queryKey: ['location-afip', params.id],
    queryFn: () => fetchAfipConfig(params.id as string),
    enabled: !!params.id,
  });

  const [settings, setSettings] = useState<LocationSettings>({});
  const [afipConfig, setAfipConfig] = useState<Partial<AfipConfig>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Initialize form data when data loads
  useState(() => {
    if (settingsData?.data) {
      setSettings(settingsData.data);
    }
    if (afipData?.data) {
      setAfipConfig(afipData.data);
    }
  });

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await updateLocationSettings(params.id as string, settings);
      if (result.success) {
        setMessage({ type: 'success', text: 'Configuración guardada' });
        queryClient.invalidateQueries({ queryKey: ['location-settings', params.id] });
      } else {
        setMessage({ type: 'error', text: result.error || 'Error al guardar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveAfip = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await updateAfipConfig(params.id as string, afipConfig);
      if (result.success) {
        setMessage({ type: 'success', text: 'Configuración AFIP guardada' });
        queryClient.invalidateQueries({ queryKey: ['location-afip', params.id] });
      } else {
        setMessage({ type: 'error', text: result.error || 'Error al guardar' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Error de conexión' });
    } finally {
      setIsSaving(false);
    }
  };

  const updateHours = (day: string, field: 'open' | 'close' | 'closed', value: string | boolean) => {
    setSettings((prev) => {
      const currentDay = prev.operatingHours?.[day] || { open: '09:00', close: '18:00' };
      return {
        ...prev,
        operatingHours: {
          ...prev.operatingHours,
          [day]: {
            open: currentDay.open,
            close: currentDay.close,
            closed: currentDay.closed,
            [field]: value,
          },
        },
      };
    });
  };

  const isLoading = loadingSettings || loadingAfip;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/dashboard/locations/${params.id}`}
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Configuración</h1>
          <p className="text-gray-500">Ajustes de la sucursal</p>
        </div>
      </div>

      {message && (
        <div
          className={`rounded-lg p-4 ${
            message.type === 'success' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('hours')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'hours'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Clock className="h-4 w-4" />
            Horarios
          </button>
          <button
            onClick={() => setActiveTab('capacity')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'capacity'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <DollarSign className="h-4 w-4" />
            Capacidad y precios
          </button>
          <button
            onClick={() => setActiveTab('afip')}
            className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === 'afip'
                ? 'border-primary-600 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <FileText className="h-4 w-4" />
            AFIP
          </button>
        </nav>
      </div>

      {isLoading ? (
        <div className="card p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      ) : (
        <>
          {/* Hours Tab */}
          {activeTab === 'hours' && (
            <div className="card">
              <div className="border-b p-4">
                <h2 className="font-semibold text-gray-900">Horarios de operación</h2>
                <p className="text-sm text-gray-500">Define los horarios de atención</p>
              </div>
              <div className="p-4 space-y-4">
                {DAYS.map((day) => (
                  <div key={day.key} className="flex items-center gap-4">
                    <div className="w-28">
                      <span className="font-medium text-gray-700">{day.label}</span>
                    </div>
                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={settings.operatingHours?.[day.key]?.closed || false}
                        onChange={(e) => updateHours(day.key, 'closed', e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-500">Cerrado</span>
                    </label>
                    <input
                      type="time"
                      value={settings.operatingHours?.[day.key]?.open || '08:00'}
                      onChange={(e) => updateHours(day.key, 'open', e.target.value)}
                      className="input w-32"
                      disabled={settings.operatingHours?.[day.key]?.closed}
                    />
                    <span className="text-gray-500">a</span>
                    <input
                      type="time"
                      value={settings.operatingHours?.[day.key]?.close || '18:00'}
                      onChange={(e) => updateHours(day.key, 'close', e.target.value)}
                      className="input w-32"
                      disabled={settings.operatingHours?.[day.key]?.closed}
                    />
                  </div>
                ))}
              </div>
              <div className="border-t p-4 flex justify-end">
                <button onClick={handleSaveSettings} className="btn-primary" disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Guardando...' : 'Guardar horarios'}
                </button>
              </div>
            </div>
          )}

          {/* Capacity Tab */}
          {activeTab === 'capacity' && (
            <div className="card">
              <div className="border-b p-4">
                <h2 className="font-semibold text-gray-900">Capacidad y precios</h2>
                <p className="text-sm text-gray-500">Configuración de capacidad y tarifas</p>
              </div>
              <div className="p-4 space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Máximo de trabajos por día
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={settings.maxJobsPerDay || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          maxJobsPerDay: parseInt(e.target.value),
                        }))
                      }
                      className="input mt-1"
                      placeholder="20"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Límite de trabajos que se pueden agendar por día
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Multiplicador de precios
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={settings.pricingMultiplier || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          pricingMultiplier: parseFloat(e.target.value),
                        }))
                      }
                      className="input mt-1"
                      placeholder="1.00"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      1.0 = precio base, 1.15 = +15% sobre el precio base
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tarifa por km de viaje ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={settings.travelFeePerKm || ''}
                      onChange={(e) =>
                        setSettings((prev) => ({
                          ...prev,
                          travelFeePerKm: parseFloat(e.target.value),
                        }))
                      }
                      className="input mt-1"
                      placeholder="50"
                    />
                  </div>
                </div>

                <div className="border-t pt-6">
                  <h3 className="font-medium text-gray-900 mb-4">Automatización</h3>
                  <div className="space-y-3">
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.autoAssignEnabled || false}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            autoAssignEnabled: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-primary-600"
                      />
                      <div>
                        <span className="font-medium text-gray-700">Asignación automática</span>
                        <p className="text-sm text-gray-500">
                          Asignar automáticamente trabajos a técnicos disponibles
                        </p>
                      </div>
                    </label>
                    <label className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={settings.notificationsEnabled ?? true}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            notificationsEnabled: e.target.checked,
                          }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-primary-600"
                      />
                      <div>
                        <span className="font-medium text-gray-700">Notificaciones</span>
                        <p className="text-sm text-gray-500">
                          Enviar notificaciones de trabajos a esta sucursal
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              </div>
              <div className="border-t p-4 flex justify-end">
                <button onClick={handleSaveSettings} className="btn-primary" disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Guardando...' : 'Guardar configuración'}
                </button>
              </div>
            </div>
          )}

          {/* AFIP Tab */}
          {activeTab === 'afip' && (
            <div className="card">
              <div className="border-b p-4">
                <h2 className="font-semibold text-gray-900">Configuración AFIP</h2>
                <p className="text-sm text-gray-500">Punto de venta para facturación electrónica</p>
              </div>
              <div className="p-4 space-y-6">
                <div className="grid gap-6 sm:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Punto de venta
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="9999"
                      value={afipConfig.puntoDeVenta || ''}
                      onChange={(e) =>
                        setAfipConfig((prev) => ({
                          ...prev,
                          puntoDeVenta: parseInt(e.target.value),
                        }))
                      }
                      className="input mt-1"
                      placeholder="1"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Tipo de punto de venta
                    </label>
                    <select
                      value={afipConfig.tiposPuntoDeVenta || 'CAE'}
                      onChange={(e) =>
                        setAfipConfig((prev) => ({
                          ...prev,
                          tiposPuntoDeVenta: e.target.value,
                        }))
                      }
                      className="input mt-1"
                    >
                      <option value="CAE">CAE (Web Services)</option>
                      <option value="CAEA">CAEA (Anticipado)</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      CUIT (opcional)
                    </label>
                    <input
                      type="text"
                      value={afipConfig.cuit || ''}
                      onChange={(e) =>
                        setAfipConfig((prev) => ({ ...prev, cuit: e.target.value }))
                      }
                      className="input mt-1"
                      placeholder="20-12345678-9"
                    />
                    <p className="mt-1 text-xs text-gray-500">
                      Si está vacío, se usa el CUIT de la organización
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Razón social (opcional)
                    </label>
                    <input
                      type="text"
                      value={afipConfig.razonSocial || ''}
                      onChange={(e) =>
                        setAfipConfig((prev) => ({ ...prev, razonSocial: e.target.value }))
                      }
                      className="input mt-1"
                      placeholder="Empresa S.A."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">
                      Condición IVA
                    </label>
                    <select
                      value={afipConfig.condicionIva || 'RESPONSABLE_INSCRIPTO'}
                      onChange={(e) =>
                        setAfipConfig((prev) => ({
                          ...prev,
                          condicionIva: e.target.value,
                        }))
                      }
                      className="input mt-1"
                    >
                      {IVA_CONDITIONS.map((cond) => (
                        <option key={cond.value} value={cond.value}>
                          {cond.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={afipConfig.isActive ?? true}
                        onChange={(e) =>
                          setAfipConfig((prev) => ({ ...prev, isActive: e.target.checked }))
                        }
                        className="h-4 w-4 rounded border-gray-300 text-primary-600"
                      />
                      <span className="font-medium text-gray-700">Punto de venta activo</span>
                    </label>
                  </div>
                </div>
              </div>
              <div className="border-t p-4 flex justify-end">
                <button onClick={handleSaveAfip} className="btn-primary" disabled={isSaving}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSaving ? 'Guardando...' : 'Guardar configuración AFIP'}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
