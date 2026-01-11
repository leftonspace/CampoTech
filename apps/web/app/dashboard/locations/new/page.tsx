'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';

interface LocationFormData {
  code: string;
  name: string;
  type: 'BRANCH' | 'WAREHOUSE' | 'SERVICE_CENTER' | 'HEADQUARTERS';
  isHeadquarters: boolean;
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  coverageRadiusKm?: number;
}

async function createLocation(data: LocationFormData): Promise<{ success: boolean; data?: { id: string }; error?: string }> {
  const response = await fetch('/api/locations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  return response.json();
}

const LOCATION_TYPES = [
  { value: 'BRANCH', label: 'Zona' },
  { value: 'HEADQUARTERS', label: 'Casa central' },
  { value: 'SERVICE_CENTER', label: 'Centro de servicio' },
  { value: 'WAREHOUSE', label: 'Depósito' },
];

export default function NewLocationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<LocationFormData>({
    code: '',
    name: '',
    type: 'BRANCH',
    isHeadquarters: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const result = await createLocation(formData);
      if (result.success && result.data) {
        router.push(`/dashboard/locations/${result.data.id}`);
      } else {
        setError(result.error || 'Error al crear la zona');
      }
    } catch (_err) {
      setError('Error de conexión');
    } finally {
      setIsSubmitting(false);
    }
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleInputChange = (field: keyof LocationFormData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));

    // Auto-set isHeadquarters when type is HEADQUARTERS
    if (field === 'type' && value === 'HEADQUARTERS') {
      setFormData((prev) => ({ ...prev, [field]: value, isHeadquarters: true }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href="/dashboard/locations"
          className="rounded-md p-2 text-gray-500 hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Nueva zona</h1>
          <p className="text-gray-500">Crear una nueva zona de servicio</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Info */}
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Información básica</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Código <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.code}
                  onChange={(e) => handleInputChange('code', e.target.value.toUpperCase())}
                  className="input mt-1"
                  placeholder="SUC-001"
                  required
                  pattern="[A-Z0-9-]+"
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá un código válido')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Código único (solo mayúsculas, números y guiones)
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Nombre <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  className="input mt-1"
                  placeholder="Zona Centro"
                  required
                  onInvalid={(e) => (e.target as HTMLInputElement).setCustomValidity('Por favor, ingresá el nombre de la zona')}
                  onInput={(e) => (e.target as HTMLInputElement).setCustomValidity('')}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Tipo <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.type}
                  onChange={(e) => handleInputChange('type', e.target.value)}
                  className="input mt-1"
                  required
                >
                  {LOCATION_TYPES.map((type) => (
                    <option key={type.value} value={type.value}>
                      {type.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.isHeadquarters}
                    onChange={(e) => handleInputChange('isHeadquarters', e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">Es casa central</span>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Contact Info */}
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Contacto</h2>
          </div>
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Dirección</label>
              <input
                type="text"
                value={formData.address || ''}
                onChange={(e) => handleInputChange('address', e.target.value)}
                className="input mt-1"
                placeholder="Av. Corrientes 1234"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Ciudad</label>
                <input
                  type="text"
                  value={formData.city || ''}
                  onChange={(e) => handleInputChange('city', e.target.value)}
                  className="input mt-1"
                  placeholder="Buenos Aires"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Provincia</label>
                <input
                  type="text"
                  value={formData.state || ''}
                  onChange={(e) => handleInputChange('state', e.target.value)}
                  className="input mt-1"
                  placeholder="CABA"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Código postal</label>
                <input
                  type="text"
                  value={formData.postalCode || ''}
                  onChange={(e) => handleInputChange('postalCode', e.target.value)}
                  className="input mt-1"
                  placeholder="1043"
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700">Teléfono</label>
                <input
                  type="tel"
                  value={formData.phone || ''}
                  onChange={(e) => handleInputChange('phone', e.target.value)}
                  className="input mt-1"
                  placeholder="+54 11 1234-5678"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={formData.email || ''}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="input mt-1"
                  placeholder="zona@empresa.com"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Geographic Info */}
        <div className="card">
          <div className="border-b p-4">
            <h2 className="font-semibold text-gray-900">Ubicación geográfica</h2>
          </div>
          <div className="p-4 space-y-4">
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="block text-sm font-medium text-gray-700">Latitud</label>
                <input
                  type="number"
                  step="any"
                  value={formData.coordinates?.lat || ''}
                  onChange={(e) =>
                    handleInputChange('coordinates', {
                      ...formData.coordinates,
                      lat: parseFloat(e.target.value),
                    })
                  }
                  className="input mt-1"
                  placeholder="-34.603722"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Longitud</label>
                <input
                  type="number"
                  step="any"
                  value={formData.coordinates?.lng || ''}
                  onChange={(e) =>
                    handleInputChange('coordinates', {
                      ...formData.coordinates,
                      lng: parseFloat(e.target.value),
                    })
                  }
                  className="input mt-1"
                  placeholder="-58.381592"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Radio de cobertura (km)
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={formData.coverageRadiusKm || ''}
                  onChange={(e) =>
                    handleInputChange('coverageRadiusKm', parseFloat(e.target.value))
                  }
                  className="input mt-1"
                  placeholder="15"
                />
              </div>
            </div>
            <p className="text-sm text-gray-500">
              Las coordenadas se pueden obtener desde Google Maps haciendo clic derecho en la
              ubicación.
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Link href="/dashboard/locations" className="btn-secondary">
            Cancelar
          </Link>
          <button type="submit" className="btn-primary" disabled={isSubmitting}>
            <Save className="mr-2 h-4 w-4" />
            {isSubmitting ? 'Guardando...' : 'Crear zona'}
          </button>
        </div>
      </form>
    </div>
  );
}
