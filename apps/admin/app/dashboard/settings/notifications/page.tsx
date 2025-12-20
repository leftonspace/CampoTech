'use client';

import { useState, useEffect } from 'react';
import { AdminAlertPreferences, AdminAlertType } from '@/types';

const ALERT_TYPE_LABELS: Record<AdminAlertType, { label: string; description: string }> = {
  new_subscription_payment: {
    label: 'Nuevo pago de suscripción',
    description: 'Cuando se recibe un pago exitoso',
  },
  failed_payment: {
    label: 'Pago fallido',
    description: 'Cuando un pago no puede ser procesado',
  },
  new_verification_submission: {
    label: 'Nueva verificación',
    description: 'Cuando se envía un documento para verificar',
  },
  document_expired: {
    label: 'Documento por vencer',
    description: 'Cuando un documento está próximo a vencer',
  },
  organization_blocked: {
    label: 'Organización bloqueada',
    description: 'Cuando una organización es bloqueada',
  },
  subscription_cancelled: {
    label: 'Suscripción cancelada',
    description: 'Cuando un usuario cancela su suscripción',
  },
  verification_approved: {
    label: 'Verificación aprobada',
    description: 'Cuando se aprueba una verificación',
  },
  verification_rejected: {
    label: 'Verificación rechazada',
    description: 'Cuando se rechaza una verificación',
  },
};

export default function NotificationSettingsPage() {
  const [preferences, setPreferences] = useState<AdminAlertPreferences | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchPreferences();
  }, []);

  async function fetchPreferences() {
    try {
      const res = await fetch('/api/admin/alerts/preferences');
      const data = await res.json();
      if (data.success) {
        setPreferences(data.data);
      }
    } catch (error) {
      console.error('Error fetching preferences:', error);
    } finally {
      setLoading(false);
    }
  }

  async function savePreferences() {
    if (!preferences) return;
    setSaving(true);
    try {
      const res = await fetch('/api/admin/alerts/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(preferences),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving preferences:', error);
    } finally {
      setSaving(false);
    }
  }

  function updateAlertType(type: AdminAlertType, channel: 'email' | 'inApp', value: boolean) {
    if (!preferences) return;
    setPreferences({
      ...preferences,
      alertTypes: {
        ...preferences.alertTypes,
        [type]: {
          ...preferences.alertTypes[type],
          [channel]: value,
        },
      },
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!preferences) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
        Error loading preferences
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Configuración de Notificaciones</h1>
        <p className="text-slate-500 mt-1">Configura cómo y cuándo recibir alertas del sistema</p>
      </div>

      {/* General Settings */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Configuración General</h2>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-slate-900">Notificaciones por email</p>
              <p className="text-sm text-slate-500">Recibir alertas por correo electrónico</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.emailEnabled}
                onChange={(e) => setPreferences({ ...preferences, emailEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {preferences.emailEnabled && (
            <div className="ml-4 pl-4 border-l-2 border-slate-200">
              <p className="text-sm font-medium text-slate-700 mb-2">Frecuencia de resumen</p>
              <select
                value={preferences.emailDigestFrequency}
                onChange={(e) => setPreferences({ ...preferences, emailDigestFrequency: e.target.value as AdminAlertPreferences['emailDigestFrequency'] })}
                className="w-48 px-3 py-2 border border-slate-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="immediate">Inmediato</option>
                <option value="daily">Resumen diario</option>
                <option value="weekly">Resumen semanal</option>
                <option value="never">Nunca</option>
              </select>
            </div>
          )}

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <div>
              <p className="font-medium text-slate-900">Notificaciones en la app</p>
              <p className="text-sm text-slate-500">Mostrar alertas en el panel de administración</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.inAppEnabled}
                onChange={(e) => setPreferences({ ...preferences, inAppEnabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>
        </div>
      </div>

      {/* Alert Types */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 mb-6">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Tipos de Alertas</h2>
        <p className="text-sm text-slate-500 mb-6">
          Selecciona qué tipos de alertas deseas recibir en cada canal
        </p>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="text-left py-3 px-4 text-sm font-medium text-slate-700">Tipo de alerta</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-700 w-24">Email</th>
                <th className="text-center py-3 px-4 text-sm font-medium text-slate-700 w-24">En App</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(Object.keys(ALERT_TYPE_LABELS) as AdminAlertType[]).map((type) => (
                <tr key={type} className="hover:bg-slate-50">
                  <td className="py-4 px-4">
                    <p className="font-medium text-slate-900">{ALERT_TYPE_LABELS[type].label}</p>
                    <p className="text-sm text-slate-500">{ALERT_TYPE_LABELS[type].description}</p>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={preferences.alertTypes[type]?.email || false}
                      onChange={(e) => updateAlertType(type, 'email', e.target.checked)}
                      disabled={!preferences.emailEnabled}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                  <td className="py-4 px-4 text-center">
                    <input
                      type="checkbox"
                      checked={preferences.alertTypes[type]?.inApp || false}
                      onChange={(e) => updateAlertType(type, 'inApp', e.target.checked)}
                      disabled={!preferences.inAppEnabled}
                      className="w-4 h-4 text-blue-600 border-slate-300 rounded focus:ring-blue-500 disabled:opacity-50"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-4">
        <button
          onClick={savePreferences}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50"
        >
          {saving ? 'Guardando...' : 'Guardar cambios'}
        </button>
        {saved && (
          <span className="text-green-600 text-sm flex items-center gap-1">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            Guardado correctamente
          </span>
        )}
      </div>
    </div>
  );
}
