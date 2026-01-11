'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { apiRequest } from '@/lib/api-client';
import { cn } from '@/lib/utils';
import {
  ArrowLeft,
  Settings,
  Bell,
  MapPin,
  Filter,
  DollarSign,
  Calendar,
  Save,
  Check,
} from 'lucide-react';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

interface LeadPreferences {
  categories: string[];
  maxDistanceKm: number;
  minBudget: number | null;
  maxBudget: number | null;
  acceptUrgent: boolean;
  acceptWeekends: boolean;
  acceptEvenings: boolean;
  notifications: {
    push: boolean;
    whatsapp: boolean;
    email: boolean;
  };
  autoDeclineRules: {
    tooFar: boolean;
    tooLow: boolean;
    wrongCategory: boolean;
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

const CATEGORY_OPTIONS = [
  { value: 'plumbing', label: 'Plomeria' },
  { value: 'electrical', label: 'Electricidad' },
  { value: 'hvac', label: 'Aire y Climatizacion' },
  { value: 'gas', label: 'Gas' },
  { value: 'locksmith', label: 'Cerrajeria' },
  { value: 'painting', label: 'Pintura' },
  { value: 'cleaning', label: 'Limpieza' },
  { value: 'moving', label: 'Mudanza' },
  { value: 'carpentry', label: 'Carpinteria' },
  { value: 'appliance_repair', label: 'Reparacion de Electrodomesticos' },
  { value: 'pest_control', label: 'Control de Plagas' },
  { value: 'roofing', label: 'Techos' },
  { value: 'landscaping', label: 'Jardineria' },
  { value: 'glass_repair', label: 'Vidrios' },
  { value: 'security', label: 'Seguridad' },
  { value: 'flooring', label: 'Pisos' },
  { value: 'general', label: 'Mantenimiento General' },
  { value: 'other', label: 'Otro' },
];

const DEFAULT_PREFERENCES: LeadPreferences = {
  categories: [],
  maxDistanceKm: 20,
  minBudget: null,
  maxBudget: null,
  acceptUrgent: true,
  acceptWeekends: false,
  acceptEvenings: false,
  notifications: {
    push: true,
    whatsapp: true,
    email: true,
  },
  autoDeclineRules: {
    tooFar: false,
    tooLow: false,
    wrongCategory: false,
  },
};

// ═══════════════════════════════════════════════════════════════════════════════
// PAGE COMPONENT
// ═══════════════════════════════════════════════════════════════════════════════

export default function LeadSettingsPage() {
  const queryClient = useQueryClient();
  const [preferences, setPreferences] = useState<LeadPreferences>(DEFAULT_PREFERENCES);
  const [hasChanges, setHasChanges] = useState(false);

  // Fetch current preferences
  const { data, isLoading } = useQuery({
    queryKey: ['lead-preferences'],
    queryFn: () => apiRequest<LeadPreferences>('/leads/preferences'),
  });

  // Update preferences mutation
  const saveMutation = useMutation({
    mutationFn: async (prefs: LeadPreferences) => {
      const response = await apiRequest('/leads/preferences', {
        method: 'PUT',
        body: prefs,
      });
      if (!response.success) {
        throw new Error(response.error?.message || 'Error al guardar');
      }
      return response;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lead-preferences'] });
      setHasChanges(false);
    },
  });

  // Load initial data
  useEffect(() => {
    if (data?.data) {
      setPreferences(data.data);
    }
  }, [data]);

  // Handle change
  const handleChange = <K extends keyof LeadPreferences>(
    field: K,
    value: LeadPreferences[K]
  ) => {
    setPreferences((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  // Handle nested change
  const handleNestedChange = <
    K extends keyof LeadPreferences,
    NK extends keyof LeadPreferences[K]
  >(
    field: K,
    nestedField: NK,
    value: LeadPreferences[K][NK]
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [field]: {
        ...(prev[field] as object),
        [nestedField]: value,
      },
    }));
    setHasChanges(true);
  };

  // Toggle category
  const toggleCategory = (category: string) => {
    const newCategories = preferences.categories.includes(category)
      ? preferences.categories.filter((c) => c !== category)
      : [...preferences.categories, category];
    handleChange('categories', newCategories);
  };

  // Handle save
  const handleSave = () => {
    saveMutation.mutate(preferences);
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 animate-pulse rounded" />
        <div className="card h-96 bg-gray-100 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/dashboard/leads"
            className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              Preferencias de Leads
            </h1>
            <p className="text-gray-500">
              Configura que leads queres recibir
            </p>
          </div>
        </div>
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className={cn(
            'btn-primary',
            !hasChanges && 'opacity-50 cursor-not-allowed'
          )}
        >
          {saveMutation.isPending ? (
            'Guardando...'
          ) : saveMutation.isSuccess && !hasChanges ? (
            <>
              <Check className="mr-2 h-4 w-4" />
              Guardado
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Guardar cambios
            </>
          )}
        </button>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Categories */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Filter className="h-5 w-5 text-gray-400" />
            Categorias de servicio
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Selecciona las categorias de servicios que ofreces
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {CATEGORY_OPTIONS.map((cat) => (
              <label
                key={cat.value}
                className={cn(
                  'flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors',
                  preferences.categories.includes(cat.value)
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300'
                )}
              >
                <input
                  type="checkbox"
                  checked={preferences.categories.includes(cat.value)}
                  onChange={() => toggleCategory(cat.value)}
                  className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">{cat.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Distance */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-400" />
            Distancia maxima
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Hasta donde estas dispuesto a viajar para un trabajo
          </p>
          <div>
            <input
              type="range"
              min={5}
              max={50}
              step={5}
              value={preferences.maxDistanceKm}
              onChange={(e) =>
                handleChange('maxDistanceKm', parseInt(e.target.value))
              }
              className="w-full"
            />
            <div className="flex justify-between text-sm text-gray-500 mt-1">
              <span>5 km</span>
              <span className="font-medium text-primary-600">
                {preferences.maxDistanceKm} km
              </span>
              <span>50 km</span>
            </div>
          </div>
        </div>

        {/* Budget */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-gray-400" />
            Rango de presupuesto
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Filtra leads por el presupuesto estimado del cliente
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Minimo
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  value={preferences.minBudget || ''}
                  onChange={(e) =>
                    handleChange(
                      'minBudget',
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  placeholder="Sin minimo"
                  className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Maximo
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">
                  $
                </span>
                <input
                  type="number"
                  value={preferences.maxBudget || ''}
                  onChange={(e) =>
                    handleChange(
                      'maxBudget',
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  placeholder="Sin maximo"
                  className="w-full pl-8 pr-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Availability */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5 text-gray-400" />
            Disponibilidad
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Indica cuando podes atender trabajos
          </p>
          <div className="space-y-3">
            <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <input
                type="checkbox"
                checked={preferences.acceptUrgent}
                onChange={(e) => handleChange('acceptUrgent', e.target.checked)}
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Acepto trabajos urgentes
                </span>
                <span className="block text-xs text-gray-500">
                  Emergencias y trabajos para el mismo dia
                </span>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <input
                type="checkbox"
                checked={preferences.acceptWeekends}
                onChange={(e) =>
                  handleChange('acceptWeekends', e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Acepto fines de semana
                </span>
                <span className="block text-xs text-gray-500">
                  Sabados y domingos
                </span>
              </div>
            </label>
            <label className="flex items-center gap-3 p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <input
                type="checkbox"
                checked={preferences.acceptEvenings}
                onChange={(e) =>
                  handleChange('acceptEvenings', e.target.checked)
                }
                className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Acepto horarios nocturnos
                </span>
                <span className="block text-xs text-gray-500">
                  Despues de las 19:00
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* Notifications */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Bell className="h-5 w-5 text-gray-400" />
            Notificaciones
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Como queres recibir avisos de nuevos leads
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Notificaciones push
                </span>
                <span className="block text-xs text-gray-500">
                  En la app y navegador
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications.push}
                onChange={(e) =>
                  handleNestedChange('notifications', 'push', e.target.checked)
                }
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  WhatsApp
                </span>
                <span className="block text-xs text-gray-500">
                  Mensajes al numero registrado
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications.whatsapp}
                onChange={(e) =>
                  handleNestedChange(
                    'notifications',
                    'whatsapp',
                    e.target.checked
                  )
                }
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Email
                </span>
                <span className="block text-xs text-gray-500">
                  Correo electronico
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.notifications.email}
                onChange={(e) =>
                  handleNestedChange('notifications', 'email', e.target.checked)
                }
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>

        {/* Auto-decline */}
        <div className="card p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Settings className="h-5 w-5 text-gray-400" />
            Rechazo automatico
          </h2>
          <p className="text-sm text-gray-500 mb-4">
            Rechazar automaticamente leads que no cumplan tus criterios
          </p>
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Muy lejos
                </span>
                <span className="block text-xs text-gray-500">
                  Supera la distancia maxima
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.autoDeclineRules.tooFar}
                onChange={(e) =>
                  handleNestedChange(
                    'autoDeclineRules',
                    'tooFar',
                    e.target.checked
                  )
                }
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Presupuesto bajo
                </span>
                <span className="block text-xs text-gray-500">
                  Menor al minimo configurado
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.autoDeclineRules.tooLow}
                onChange={(e) =>
                  handleNestedChange(
                    'autoDeclineRules',
                    'tooLow',
                    e.target.checked
                  )
                }
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
            <label className="flex items-center justify-between p-3 rounded-lg border cursor-pointer hover:border-gray-300">
              <div>
                <span className="block text-sm font-medium text-gray-700">
                  Categoria incorrecta
                </span>
                <span className="block text-xs text-gray-500">
                  No esta en mis categorias
                </span>
              </div>
              <input
                type="checkbox"
                checked={preferences.autoDeclineRules.wrongCategory}
                onChange={(e) =>
                  handleNestedChange(
                    'autoDeclineRules',
                    'wrongCategory',
                    e.target.checked
                  )
                }
                className="h-5 w-5 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
              />
            </label>
          </div>
        </div>
      </div>

      {/* Save button at bottom for mobile */}
      <div className="lg:hidden sticky bottom-4">
        <button
          onClick={handleSave}
          disabled={!hasChanges || saveMutation.isPending}
          className={cn(
            'btn-primary w-full',
            !hasChanges && 'opacity-50 cursor-not-allowed'
          )}
        >
          {saveMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
        </button>
      </div>
    </div>
  );
}
