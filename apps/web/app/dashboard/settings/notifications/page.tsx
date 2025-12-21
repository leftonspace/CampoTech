'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import {
  ArrowLeft,
  Bell,
  MessageCircle,
  Mail,
  Smartphone,
  Monitor,
  Clock,
  Save,
  Moon,
  Volume2,
  VolumeX,
  Check,
} from 'lucide-react';

interface NotificationPreferences {
  webEnabled: boolean;
  pushEnabled: boolean;
  smsEnabled: boolean;
  emailEnabled: boolean;
  whatsappEnabled: boolean;
  eventPreferences: Record<string, Record<string, boolean>>;
  reminderIntervals: number[];
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
}

const EVENT_TYPES = [
  { key: 'job_assigned', label: 'Trabajo asignado', description: 'Cuando te asignan un nuevo trabajo' },
  { key: 'job_reminder', label: 'Recordatorio de trabajo', description: 'Recordatorios antes de trabajos programados' },
  { key: 'job_completed', label: 'Trabajo completado', description: 'Cuando un trabajo es completado' },
  { key: 'schedule_change', label: 'Cambio de horario', description: 'Cuando cambia el horario de un trabajo' },
  { key: 'invoice_created', label: 'Factura creada', description: 'Cuando se genera una nueva factura' },
  { key: 'payment_received', label: 'Pago recibido', description: 'Cuando se recibe un pago' },
  { key: 'team_member_added', label: 'Nuevo miembro', description: 'Cuando se agrega un miembro al equipo' },
  { key: 'system_alert', label: 'Alertas del sistema', description: 'Alertas importantes del sistema' },
];

const CHANNELS = [
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, color: 'text-green-600' },
  { key: 'push', label: 'Push', icon: Smartphone, color: 'text-blue-600' },
  { key: 'email', label: 'Email', icon: Mail, color: 'text-orange-600' },
  { key: 'sms', label: 'SMS', icon: Monitor, color: 'text-purple-600' },
];

const REMINDER_OPTIONS = [
  { minutes: 1440, label: '24 horas antes' },
  { minutes: 60, label: '1 hora antes' },
  { minutes: 30, label: '30 minutos antes' },
  { minutes: 15, label: '15 minutos antes' },
];

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [localPrefs, setLocalPrefs] = useState<NotificationPreferences | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['notification-preferences'],
    queryFn: async () => {
      const response = await fetch('/api/notifications/preferences');
      return response.json();
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: Partial<NotificationPreferences>) => {
      const response = await fetch('/api/notifications/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
      setHasChanges(false);
      setSaveSuccess(true);
      // Hide success message after 3 seconds
      setTimeout(() => setSaveSuccess(false), 3000);
    },
  });

  useEffect(() => {
    if (data?.data) {
      setLocalPrefs(data.data);
    }
  }, [data]);

  const handleChannelToggle = (channel: string, enabled: boolean) => {
    if (!localPrefs) return;

    const key = `${channel}Enabled` as keyof NotificationPreferences;
    setLocalPrefs({ ...localPrefs, [key]: enabled });
    setHasChanges(true);
  };

  const handleEventChannelToggle = (eventType: string, channel: string, enabled: boolean) => {
    if (!localPrefs) return;

    const newEventPrefs = { ...localPrefs.eventPreferences };
    if (!newEventPrefs[eventType]) {
      newEventPrefs[eventType] = {};
    }
    newEventPrefs[eventType][channel] = enabled;

    setLocalPrefs({ ...localPrefs, eventPreferences: newEventPrefs });
    setHasChanges(true);
  };

  const handleReminderToggle = (minutes: number, enabled: boolean) => {
    if (!localPrefs) return;

    let newIntervals = [...localPrefs.reminderIntervals];
    if (enabled) {
      if (!newIntervals.includes(minutes)) {
        newIntervals.push(minutes);
        newIntervals.sort((a, b) => b - a); // Sort descending
      }
    } else {
      newIntervals = newIntervals.filter((m) => m !== minutes);
    }

    setLocalPrefs({ ...localPrefs, reminderIntervals: newIntervals });
    setHasChanges(true);
  };

  const handleQuietHoursChange = (updates: Partial<NotificationPreferences>) => {
    if (!localPrefs) return;
    setLocalPrefs({ ...localPrefs, ...updates });
    setHasChanges(true);
  };

  const handleSave = () => {
    if (localPrefs) {
      updateMutation.mutate(localPrefs);
    }
  };

  if (isLoading || !localPrefs) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20 sm:pb-0">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/settings"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notificaciones</h1>
            <p className="text-gray-500">Configurá cómo y cuándo recibís notificaciones</p>
          </div>
        </div>
        {(hasChanges || saveSuccess) && (
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || saveSuccess}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-300 ${
              saveSuccess
                ? 'bg-green-600 text-white cursor-default'
                : 'btn-primary'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="h-4 w-4" />
                Guardado
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </>
            )}
          </button>
        )}
      </div>

      {/* Channels */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Bell className="h-5 w-5 text-gray-500" />
          Canales de notificación
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Activá los canales por donde querés recibir notificaciones. WhatsApp es el recomendado para Argentina.
        </p>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {CHANNELS.map(({ key, label, icon: Icon, color }) => {
            const isEnabled = localPrefs[`${key}Enabled` as keyof NotificationPreferences] as boolean;
            return (
              <label
                key={key}
                className={`relative flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                  isEnabled
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => handleChannelToggle(key, e.target.checked)}
                  className="sr-only"
                />
                <Icon className={`h-6 w-6 ${isEnabled ? color : 'text-gray-400'}`} />
                <div>
                  <p className={`font-medium ${isEnabled ? 'text-gray-900' : 'text-gray-500'}`}>
                    {label}
                  </p>
                  {key === 'whatsapp' && (
                    <span className="text-xs text-green-600">Recomendado</span>
                  )}
                </div>
                <div
                  className={`ml-auto w-10 h-6 rounded-full transition-colors ${
                    isEnabled ? 'bg-primary-600' : 'bg-gray-300'
                  }`}
                >
                  <div
                    className={`w-4 h-4 mt-1 ml-1 rounded-full bg-white transition-transform ${
                      isEnabled ? 'translate-x-4' : ''
                    }`}
                  />
                </div>
              </label>
            );
          })}
        </div>
      </div>

      {/* Event preferences */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Volume2 className="h-5 w-5 text-gray-500" />
          Preferencias por tipo de evento
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Elegí qué canales usar para cada tipo de notificación.
        </p>

        <div className="overflow-x-auto -mx-6 px-6">
          <table className="min-w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left py-3 pr-4 text-sm font-medium text-gray-500">Evento</th>
                {CHANNELS.map(({ key, label, icon: Icon }) => (
                  <th key={key} className="px-4 py-3 text-center text-sm font-medium text-gray-500">
                    <div className="flex flex-col items-center gap-1">
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {EVENT_TYPES.map(({ key, label, description }) => (
                <tr key={key} className="hover:bg-gray-50">
                  <td className="py-4 pr-4">
                    <p className="font-medium text-gray-900">{label}</p>
                    <p className="text-sm text-gray-500">{description}</p>
                  </td>
                  {CHANNELS.map(({ key: channelKey }) => {
                    const isEnabled = localPrefs.eventPreferences[key]?.[channelKey] ?? false;
                    const channelEnabled = localPrefs[`${channelKey}Enabled` as keyof NotificationPreferences];
                    return (
                      <td key={channelKey} className="px-4 py-4 text-center">
                        <input
                          type="checkbox"
                          checked={isEnabled}
                          disabled={!channelEnabled}
                          onChange={(e) => handleEventChannelToggle(key, channelKey, e.target.checked)}
                          className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500 disabled:opacity-50"
                        />
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Reminder intervals */}
      <div className="card p-6">
        <h2 className="text-lg font-medium text-gray-900 mb-4 flex items-center gap-2">
          <Clock className="h-5 w-5 text-gray-500" />
          Recordatorios de trabajos
        </h2>
        <p className="text-sm text-gray-500 mb-4">
          Elegí cuándo querés recibir recordatorios antes de un trabajo programado.
        </p>

        <div className="flex flex-wrap gap-3">
          {REMINDER_OPTIONS.map(({ minutes, label }) => {
            const isEnabled = localPrefs.reminderIntervals.includes(minutes);
            return (
              <label
                key={minutes}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg border cursor-pointer transition-colors ${
                  isEnabled
                    ? 'border-primary-500 bg-primary-50 text-primary-700'
                    : 'border-gray-200 text-gray-600 hover:border-gray-300'
                }`}
              >
                <input
                  type="checkbox"
                  checked={isEnabled}
                  onChange={(e) => handleReminderToggle(minutes, e.target.checked)}
                  className="sr-only"
                />
                <Clock className="h-4 w-4" />
                {label}
              </label>
            );
          })}
        </div>
      </div>

      {/* Quiet hours */}
      <div className="card p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Moon className="h-5 w-5 text-gray-500" />
            <h2 className="text-lg font-medium text-gray-900">Horario de descanso</h2>
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <span className="text-sm text-gray-600">
              {localPrefs.quietHoursEnabled ? 'Activado' : 'Desactivado'}
            </span>
            <div
              onClick={() =>
                handleQuietHoursChange({ quietHoursEnabled: !localPrefs.quietHoursEnabled })
              }
              className={`w-10 h-6 rounded-full transition-colors cursor-pointer ${
                localPrefs.quietHoursEnabled ? 'bg-primary-600' : 'bg-gray-300'
              }`}
            >
              <div
                className={`w-4 h-4 mt-1 ml-1 rounded-full bg-white transition-transform ${
                  localPrefs.quietHoursEnabled ? 'translate-x-4' : ''
                }`}
              />
            </div>
          </label>
        </div>

        <p className="text-sm text-gray-500 mb-4">
          Durante el horario de descanso, las notificaciones se guardan y envían cuando termine.
        </p>

        {localPrefs.quietHoursEnabled && (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <VolumeX className="h-4 w-4 text-gray-400" />
              <label className="text-sm text-gray-600">Desde</label>
              <input
                type="time"
                value={localPrefs.quietHoursStart}
                onChange={(e) => handleQuietHoursChange({ quietHoursStart: e.target.value })}
                className="input w-32"
              />
            </div>
            <div className="flex items-center gap-2">
              <Volume2 className="h-4 w-4 text-gray-400" />
              <label className="text-sm text-gray-600">Hasta</label>
              <input
                type="time"
                value={localPrefs.quietHoursEnd}
                onChange={(e) => handleQuietHoursChange({ quietHoursEnd: e.target.value })}
                className="input w-32"
              />
            </div>
            <p className="text-xs text-gray-400">
              Zona horaria: Argentina (Buenos Aires)
            </p>
          </div>
        )}
      </div>

      {/* Save button (mobile) */}
      {(hasChanges || saveSuccess) && (
        <div className="fixed bottom-4 left-4 right-4 sm:hidden">
          <button
            onClick={handleSave}
            disabled={updateMutation.isPending || saveSuccess}
            className={`w-full py-3 flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-300 ${
              saveSuccess
                ? 'bg-green-600 text-white cursor-default'
                : 'btn-primary'
            }`}
          >
            {saveSuccess ? (
              <>
                <Check className="h-4 w-4" />
                Guardado
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
