'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCUIT } from '@/lib/utils';
import { ArrowLeft, Save, Building, MapPin, Phone, Mail, FileText } from 'lucide-react';

interface Organization {
  id: string;
  name: string;
  cuit: string;
  address?: {
    street?: string;
    city?: string;
    province?: string;
    postalCode?: string;
  };
  phone?: string;
  email?: string;
  ivaCondition?: string;
  activityStartDate?: string;
  logoUrl?: string;
}

const IVA_CONDITIONS = [
  { value: 'RESPONSABLE_INSCRIPTO', label: 'Responsable Inscripto' },
  { value: 'MONOTRIBUTISTA', label: 'Monotributista' },
  { value: 'EXENTO', label: 'Exento' },
];

const PROVINCES = [
  'Buenos Aires',
  'CABA',
  'Catamarca',
  'Chaco',
  'Chubut',
  'Córdoba',
  'Corrientes',
  'Entre Ríos',
  'Formosa',
  'Jujuy',
  'La Pampa',
  'La Rioja',
  'Mendoza',
  'Misiones',
  'Neuquén',
  'Río Negro',
  'Salta',
  'San Juan',
  'San Luis',
  'Santa Cruz',
  'Santa Fe',
  'Santiago del Estero',
  'Tierra del Fuego',
  'Tucumán',
];

export default function OrganizationSettingsPage() {
  const queryClient = useQueryClient();
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [formData, setFormData] = useState<Partial<Organization>>({
    name: '',
    cuit: '',
    address: {
      street: '',
      city: '',
      province: '',
      postalCode: '',
    },
    phone: '',
    email: '',
    ivaCondition: 'RESPONSABLE_INSCRIPTO',
    activityStartDate: '',
  });

  const { data, isLoading } = useQuery({
    queryKey: ['organization'],
    queryFn: () => api.organization.get(),
  });

  const organization = data?.data as Organization | undefined;

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || '',
        cuit: organization.cuit || '',
        address: {
          street: organization.address?.street || '',
          city: organization.address?.city || '',
          province: organization.address?.province || '',
          postalCode: organization.address?.postalCode || '',
        },
        phone: organization.phone || '',
        email: organization.email || '',
        ivaCondition: organization.ivaCondition || 'RESPONSABLE_INSCRIPTO',
        activityStartDate: organization.activityStartDate || '',
      });
    }
  }, [organization]);

  const updateMutation = useMutation({
    mutationFn: (data: Partial<Organization>) => api.organization.update(data),
    onSuccess: (response) => {
      if (response.success) {
        setSuccess('Datos guardados correctamente');
        setHasChanges(false);
        queryClient.invalidateQueries({ queryKey: ['organization'] });
        setTimeout(() => setSuccess(''), 3000);
      } else {
        setError(response.error?.message || 'Error al guardar');
      }
    },
    onError: () => {
      setError('Error al guardar los datos');
    },
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
    setError('');
    setSuccess('');
  };

  const handleAddressChange = (field: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      address: { ...prev.address, [field]: value },
    }));
    setHasChanges(true);
    setError('');
    setSuccess('');
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const formatCuit = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 10) return `${digits.slice(0, 2)}-${digits.slice(2)}`;
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
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
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Organización</h1>
          <p className="text-gray-500">Datos de tu empresa</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Business info */}
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building className="h-5 w-5 text-gray-400" />
            <h2 className="font-medium text-gray-900">Datos fiscales</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="name" className="label mb-1 block">
                Razón social *
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleChange('name', e.target.value)}
                className="input"
                required
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="cuit" className="label mb-1 block">
                  CUIT *
                </label>
                <input
                  id="cuit"
                  type="text"
                  value={formatCuit(formData.cuit || '')}
                  onChange={(e) => handleChange('cuit', e.target.value)}
                  placeholder="XX-XXXXXXXX-X"
                  className="input"
                  required
                />
              </div>
              <div>
                <label htmlFor="ivaCondition" className="label mb-1 block">
                  Condición IVA
                </label>
                <select
                  id="ivaCondition"
                  value={formData.ivaCondition}
                  onChange={(e) => handleChange('ivaCondition', e.target.value)}
                  className="input"
                >
                  {IVA_CONDITIONS.map((condition) => (
                    <option key={condition.value} value={condition.value}>
                      {condition.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label htmlFor="activityStartDate" className="label mb-1 block">
                Inicio de actividades
              </label>
              <input
                id="activityStartDate"
                type="date"
                value={formData.activityStartDate}
                onChange={(e) => handleChange('activityStartDate', e.target.value)}
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <MapPin className="h-5 w-5 text-gray-400" />
            <h2 className="font-medium text-gray-900">Dirección fiscal</h2>
          </div>

          <div className="space-y-4">
            <div>
              <label htmlFor="street" className="label mb-1 block">
                Calle y número
              </label>
              <input
                id="street"
                type="text"
                value={formData.address?.street}
                onChange={(e) => handleAddressChange('street', e.target.value)}
                placeholder="Av. Corrientes 1234"
                className="input"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label htmlFor="city" className="label mb-1 block">
                  Ciudad
                </label>
                <input
                  id="city"
                  type="text"
                  value={formData.address?.city}
                  onChange={(e) => handleAddressChange('city', e.target.value)}
                  className="input"
                />
              </div>
              <div>
                <label htmlFor="province" className="label mb-1 block">
                  Provincia
                </label>
                <select
                  id="province"
                  value={formData.address?.province}
                  onChange={(e) => handleAddressChange('province', e.target.value)}
                  className="input"
                >
                  <option value="">Seleccionar...</option>
                  {PROVINCES.map((province) => (
                    <option key={province} value={province}>
                      {province}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="postalCode" className="label mb-1 block">
                  Código postal
                </label>
                <input
                  id="postalCode"
                  type="text"
                  value={formData.address?.postalCode}
                  onChange={(e) => handleAddressChange('postalCode', e.target.value)}
                  className="input"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Contact */}
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Phone className="h-5 w-5 text-gray-400" />
            <h2 className="font-medium text-gray-900">Contacto</h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="phone" className="label mb-1 block">
                Teléfono
              </label>
              <input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => handleChange('phone', e.target.value)}
                placeholder="+54 11 1234-5678"
                className="input"
              />
            </div>
            <div>
              <label htmlFor="email" className="label mb-1 block">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => handleChange('email', e.target.value)}
                placeholder="contacto@empresa.com"
                className="input"
              />
            </div>
          </div>
        </div>

        {/* Messages */}
        {error && (
          <div className="rounded-md bg-danger-50 p-4 text-danger-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-md bg-success-50 p-4 text-success-700">
            {success}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2">
          <Link href="/dashboard/settings" className="btn-outline">
            Cancelar
          </Link>
          <button
            type="submit"
            disabled={updateMutation.isPending || !hasChanges}
            className="btn-primary"
          >
            <Save className="mr-2 h-4 w-4" />
            {updateMutation.isPending ? 'Guardando...' : 'Guardar cambios'}
          </button>
        </div>
      </form>
    </div>
  );
}
