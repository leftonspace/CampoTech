'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api-client';
import { formatCUIT } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { ArrowLeft, Save, Building, MapPin, Phone, Mail, FileText, AlertTriangle } from 'lucide-react';
import { LockedField, LockedFieldGroup } from '@/components/ui/locked-field';
import { PermissionField, PermissionSelect } from '@/components/ui/permission-field';
import { ORGANIZATION_FIELDS, getFieldMetadata, type UserRole } from '@/lib/config/field-permissions';

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
  const { user } = useAuth();
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Get user role for field permissions
  const userRole = useMemo(() => {
    return (user?.role?.toUpperCase() || 'VIEWER') as UserRole;
  }, [user?.role]);

  // Get field metadata based on user role
  const fieldMeta = useMemo(() => {
    return getFieldMetadata(ORGANIZATION_FIELDS, userRole);
  }, [userRole]);

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
        {/* Locked fiscal fields - cannot be changed */}
        <LockedFieldGroup
          title="Datos fiscales registrados"
          description="Estos datos estan vinculados a AFIP y no pueden ser modificados desde aqui. Para solicitar un cambio, contacte a soporte@campotech.com con la documentacion correspondiente."
        >
          <div className="space-y-4">
            <LockedField
              label="Razon Social"
              value={formData.name}
              message={fieldMeta.razonSocial?.message || 'Este campo no puede ser modificado'}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <LockedField
                label="CUIT"
                value={formatCuit(formData.cuit || '')}
                message={fieldMeta.cuit?.message || 'CUIT no puede ser modificado'}
              />
              <LockedField
                label="Condicion IVA"
                value={IVA_CONDITIONS.find(c => c.value === formData.ivaCondition)?.label || formData.ivaCondition || '-'}
                message={fieldMeta.ivaCondition?.message || 'Condicion IVA no puede ser modificada'}
              />
            </div>

            {formData.activityStartDate && (
              <LockedField
                label="Inicio de actividades"
                value={formData.activityStartDate}
                message="Fecha registrada en AFIP"
              />
            )}
          </div>

          {/* Request change link */}
          <div className="mt-4 pt-4 border-t border-gray-200">
            <Link
              href="/dashboard/support/change-request?entity=organization&field=fiscal"
              className="text-sm text-primary-600 hover:underline flex items-center gap-1"
            >
              <AlertTriangle className="h-4 w-4" />
              Solicitar cambio de datos fiscales
            </Link>
          </div>
        </LockedFieldGroup>

        {/* Editable commercial name */}
        <div className="card p-6">
          <div className="mb-4 flex items-center gap-2">
            <Building className="h-5 w-5 text-gray-400" />
            <h2 className="font-medium text-gray-900">Datos comerciales</h2>
          </div>

          <div className="space-y-4">
            <PermissionField
              name="nombreComercial"
              label="Nombre comercial"
              value={formData.name}
              meta={fieldMeta.nombreComercial || { visible: true, editable: true, locked: false }}
              onChange={(value) => handleChange('name', value)}
              placeholder="Nombre que usan tus clientes"
            />
          </div>
        </div>

        {/* Address - requires approval for fiscal address */}
        <div className="card p-6">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="h-5 w-5 text-gray-400" />
              <h2 className="font-medium text-gray-900">Domicilio fiscal</h2>
            </div>
            {fieldMeta.domicilioFiscal?.requiresApproval && (
              <span className="text-xs text-amber-600 flex items-center gap-1">
                <AlertTriangle className="h-3 w-3" />
                Cambios requieren verificacion
              </span>
            )}
          </div>

          <div className="space-y-4">
            <PermissionField
              name="street"
              label="Calle y numero"
              value={formData.address?.street}
              meta={fieldMeta.domicilioFiscal || { visible: true, editable: true, locked: false, requiresApproval: true }}
              onChange={(value) => handleAddressChange('street', value)}
              placeholder="Av. Corrientes 1234"
            />

            <div className="grid gap-4 sm:grid-cols-3">
              <PermissionField
                name="city"
                label="Ciudad"
                value={formData.address?.city}
                meta={fieldMeta.domicilioFiscal || { visible: true, editable: true, locked: false, requiresApproval: true }}
                onChange={(value) => handleAddressChange('city', value)}
              />
              <PermissionSelect
                name="province"
                label="Provincia"
                value={formData.address?.province}
                meta={fieldMeta.domicilioFiscal || { visible: true, editable: true, locked: false, requiresApproval: true }}
                onChange={(value) => handleAddressChange('province', value)}
                options={PROVINCES.map(p => ({ value: p, label: p }))}
                placeholder="Seleccionar..."
              />
              <PermissionField
                name="postalCode"
                label="Codigo postal"
                value={formData.address?.postalCode}
                meta={fieldMeta.domicilioFiscal || { visible: true, editable: true, locked: false, requiresApproval: true }}
                onChange={(value) => handleAddressChange('postalCode', value)}
              />
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
            <PermissionField
              name="phone"
              label="Telefono"
              value={formData.phone}
              meta={fieldMeta.phone || { visible: true, editable: true, locked: false }}
              onChange={(value) => handleChange('phone', value)}
              type="tel"
              placeholder="+54 11 1234-5678"
            />
            <PermissionField
              name="email"
              label="Email"
              value={formData.email}
              meta={fieldMeta.email || { visible: true, editable: true, locked: false }}
              onChange={(value) => handleChange('email', value)}
              type="email"
              placeholder="contacto@empresa.com"
            />
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
